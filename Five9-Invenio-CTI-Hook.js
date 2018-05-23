/**
 * Global ADT custom script entry point
 */
function customerJsEntry() {
    console.log('invenio-adapter: customerJsEntry()');
    //noinspection JSUnresolvedFunction
    var params = getUrlParams(); // from adt.main.html

    defineAdapter();

    require([
        //include custom components
        'components/invenio-adapter/main'
    ], function (adapter) {
        adapter.initialize();
    });
}

var isNewWindow = false,
    sPageInfo = null,
    sHostName = '';
/**
 * Component definition function
 */
function defineAdapter() {
    //components must be defined with 'components/<name>/main' name
    define('components/invenio-adapter/main', [
            'ui.api.v1',
            'underscore',
            'presentation.models/pres.model.events'
          
    ],

        function (UiApi, _,  Events) {

            return {
                isSfdcIFrame: false,
                campaignId: '',
                agentId: '',
                sessionId: '',
                state: '',
                startTime: '',
                callId: '',
                sfObject: UiApi.getSFApiWrapper(),
                handledEvents: ['DISCONNECTED_BY_AGENT', 'DISCONNECTED_BY_CALLER', 'FAILED_TO_CONNECT'],
                clickTODialModel: undefined,
                CreateClickTODialModel:function(){
                    if(!this.clickTODialModel){
                       this.clickTODialModel = new UiApi.LocalModel({
                             name: 'CustomClickTODialLocalModel',
                             sessionId: UiApi.Context.authToken,
                             version: '0.01',                             
                             attributes: {
                                    clickTODialData: {default: null, persistence: UiApi.LocalModel.Persistence.Session}
                                }
                         });
                    }
                },
                /**
                 * Logging method
                 *
                 * @param fn
                 * @param msg
                 */
                log: function (fn, msg) {
                    msg = (typeof msg == 'undefined' ? '' : msg);
                    console.log('invenio-adapter.' + fn + ': ' + msg);
                },

                getDefaultSettings: function () {
                    if (!this.isSfdcIFrame) return;
                    this.sfObject.runApex('Five9InvenioSettingsRetrieval', 'getSettings', '', this.onSettingsConsumed);
                },
                getpageInfo: function () {
                    if (!this.isSfdcIFrame) return;
                    this.sfObject.getPageInfo(this.setpageInfoData)
                },
                setpageInfoData: function (response) {
                    if (response.result) {
                        sPageInfo = JSON.parse(response.result);
                        if (sPageInfo.url != '') {
                            var url = sPageInfo.url.split('.com');
                            sHostName = url[0] + '.com';
                        }
                    }

                },
                onSettingsConsumed: function (response) {
                    if (response.result) {
                        isNewWindow = response.result;
                    }
                },


                /**
                 * Bootstrap method into adapter. Initializes UiApi event listener.
                 */
                initialize: function () {

                    var me = this;

                    this.CreateClickTODialModel();
                    this.log('initialize');

                    try {
                        var sfdcIFrameOrigin = decodeURIComponent(location.search).match(/sfdcIFrameOrigin=(.*?)&/)[1];
                        this.isSfdcIFrame = !!sfdcIFrameOrigin;
                        this.getDefaultSettings();
                        this.getpageInfo();


                    } catch (e) {
                        this.log('sfURL error: ' + e.message);
                    }
                    this.initWindowListener();

                  //  UiApi.vent.on('all', this.handleUiApiVent, this);
                    UiApi.vent.on(Events.SessionInitialized, _.bind(this.onSessionInitialized, this));
                    UiApi.vent.on(Events.CRMClick2Dial, _.bind(this.onClickToDial,this));

                  
                },
                onClickToDial: function(event){
                     this.log('onClickToDial: event: ', JSON.stringify(event));
                    
                    if (!this.isSfdcIFrame) return;
                    this.clickTODialModel.set('clickTODialData', event); // TODO DEBUG  

                },
                /**
                 * Main ADT UiApi event listener. Watches for agent context and starts
                 * agent model listeners.
                 *c
                 * @param eventName
                 * @param data
                 */
                onSessionInitialized: function () {
                    this.log('onSessionInitialized',
                        '(' + UiApi.Context.AgentId + ',' + UiApi.Context.TenantId + ',' + this.isSfdcIFrame +')');
                   
                    var me = this;                    
                    if (!this.isSfdcIFrame) return;
                        if (UiApi.Context.Agent) {
                            this.log('onSessionInitialized', 'adding call listener.');
                            UiApi.Context.Agent.Call().on('add change', me.handleCallInfo, this);               
                        }
                },
                getCallVariableByName: function(cavName) {
                  return _.find(UiApi.Context.Tenant.CallVariables().models, function(cav) {
                        return cav.get('group')+'.'+cav.get('name') == cavName;
                    });
                },

                handleCallInfo: function (agentData, eventData) {
                    if (!this.isSfdcIFrame) return;

                    this.log('handleCallInfo: agentData: ', JSON.stringify(agentData));
                    this.log('handleCallInfo: EventData: ', JSON.stringify(eventData));

                    if (eventData != null && eventData.context != null) {
                        if (_.contains(this.handledEvents, eventData.context.eventReason)) {
                            if (agentData != null) {
                                this.campaignId = agentData.attributes != null ? agentData.attributes.campaignId : '';
                                this.state = agentData.attributes != null ? agentData.attributes.state : '';
                                this.startTime = agentData.attributes != null ? agentData.attributes.startTimestamp : '';
                                this.callId = agentData.id;
                                var variables = agentData.get('variables');
                                var sessionKey = this.getCallVariableByName('Call.session_id');
                                if (sessionKey) {
                                    this.sessionId = variables[sessionKey.get('id')];
                                }
                            }
                            this.agentId = eventData.context.userId;
                            var dataClickToDial= this.clickTODialModel.get('clickTODialData');                            
                           var redirectUrl = '/apex/Five9invenioDisposition?caid=' + this.callId + '&aid=' + this.agentId + '&cid=' + this.campaignId + '&sid=' + this.sessionId + '&state=' + this.state + '&stime=' + this.startTime +( dataClickToDial == null || dataClickToDial.pageInfo == null?'':(dataClickToDial.pageInfo.isWho == false && dataClickToDial.pageInfo.isWhat== false? '':'&objId='+dataClickToDial.pageInfo.objectId));
                           
                      
                           
                            if (isNewWindow && ie === undefined) {
                               if(vis()){
                                    var newWin = window.open(sHostName + redirectUrl, '_blank');
                                    newWin.focus();                                
                                }
                            }
                            else {  
                                    console.log('CurrentTab: - '+vis());                        
                                     if(vis()){
                                        //this.sfObject.screenPop(redirectUrl, false);
										window.top.location.href = sHostName + redirectUrl;
                                  }
                                }
                            }
                        }
                    },
                
                handleActiveSkills: function (agentData, eventData) {
                    if (!this.isSfdcIFrame) return;
                    this.log('handleActiveSkills', JSON.stringify(agentData));
                    this.log('handleActiveSkillsData1', JSON.stringify(eventData));

                },

                /**
                 * Initializes the window event listener
                 */
                initWindowListener: function () {
                    var me = this;
                    window.addEventListener('message', receiveMessage, false);
                    function receiveMessage(event) {
                        me.log('receiveMessage (' + event.origin + '):');
                    }
                }
            }
        }
    )
}


var ie = (function () {
    var undef, rv = -1; // Return value assumes failure.
    var ua = window.navigator.userAgent;
    var msie = ua.indexOf('MSIE ');
    var trident = ua.indexOf('Trident/');

    if (msie > 0) {
        // IE 10 or older => return version number
        rv = parseInt(ua.substring(msie + 5, ua.indexOf('.', msie)), 10);
    } else if (trident > 0) {
        // IE 11 (or newer) => return version number
        var rvNum = ua.indexOf('rv:');
        rv = parseInt(ua.substring(rvNum + 3, ua.indexOf('.', rvNum)), 10);
    }

    return ((rv > -1) ? rv : undef);
}());


var vis = (function(){
    var stateKey, eventKey, keys = {
        hidden: "visibilitychange",
        webkitHidden: "webkitvisibilitychange",
        mozHidden: "mozvisibilitychange",
        msHidden: "msvisibilitychange"
    };
    for (stateKey in keys) {
        if (stateKey in document) {
            eventKey = keys[stateKey];
            break;
        }
    }
    return function(c) {
        if (c) document.addEventListener(eventKey, c);
        return !document[stateKey];
    }
})();
