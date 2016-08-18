/**
 * Global ADT custom script entry point
 */
function customerJsEntry() {
    console.log('ypg-connector: customerJsEntry()');
    //noinspection JSUnresolvedFunction
    var params = getUrlParams(); // from adt.main.html

    defineAdapter();

    require([
        //include custom components
        'components/ypg-connector/main'
    ], function (adapter) {
        adapter.initialize();
    });
}

var sPageInfo = null,
    sHostName = '',
    taskId='',
    callInfo = {
                    usrId: '',
                    sesId: '',
                    campId: '',
                    campNm:'',
                    calTp:'', 
                    calANI: '',
                    calDNIS: '',
                    calMSes:'',
                    calHOff: '',
                    calUsrN: '',
                    calFllN:'',
                    calUsrE: '',
                    calSkill:'',
                    calTsk:  '',
                    calEvnt: '',
                    taskId:'',
                    calHndlTm:'',
                    callId:'',
                    calWrapTm:''
                };

/**
 * Component definition function
 */
function defineAdapter() {
    //components must be defined with 'components/<name>/main' name
    define('components/ypg-connector/main', [
            'ui.api.v1',
            'underscore',
            'models/server/callConstants',
            'presentation.models/pres.model.events'
          
    ],

        function (UiApi, _, CallConstants,  Events) {
            

            return {
                isSfdcIFrame: false,

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
                                    clickTODialData: {default: null, persistence: UiApi.LocalModel.Persistence.Session},
                                    callInfo:{default:null, persistence: UiApi.LocalModel.Persistence.Session},
                                    taskId:{default:'',persistence:UiApi.LocalModel.Persistence.Session},
                                    sfdcUserId:{default:'',persistence:UiApi.LocalModel.Persistence.Session}
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
                    console.log('ypg-connector.' + fn + ': ' + msg);
                },

                getDefaultSettings: function () {
                    var _self = this;
                   this.onSettingsConsumed = function (response) {
                    if (response.result) {
                            var currentSfdcUserId = response.result;
                            _self.clickTODialModel.set('sfdcUserId', currentSfdcUserId); // TODO DEBUG                          
                        }      
                    };                 
                
                    if (!this.isSfdcIFrame) return;
                    this.sfObject.runApex('ypg_ManageObjects', 'F9GetCurrentUserId', '', this.onSettingsConsumed);
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
               
                onSuccessfulSetCallInfo:function(response){
                    if(response.result){
                      console.log('ypg-connector.'+ response);                     
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
                            this.log('onSessionInitialized', 'checking listeners.');
                            if (!UiApi.Context.Agent.Call()._events) {
                                this.log('onSessionInitialized', 'adding call listener.');
                                UiApi.Context.Agent.Call().on('add change', me.handleCallInfo, this);
                               
                            }                             
                        }
                },
                getCallVariableByName: function(cavName) {
                  return _.find(UiApi.Context.Tenant.CallVariables().models, function(cav) {
                        return cav.get('group')+'.'+cav.get('name') == cavName;
                    });
                },

                handleCallInfo: function (agentData, eventData) {
                     UiApi.Context.Tenant.CallVariables().fetch();
                    if (!this.isSfdcIFrame) return;
                    var _self = this;
                     this.onTaskCreated = function(response){
                        if(response.result){
                                console.log('ypg-connector.onTaskCreated'+ response .result);
                                taskId= response.result;
                                 _self.clickTODialModel.set('taskId', taskId); // TODO DEBUG  
                                 var currentCallInfo = _self.clickTODialModel.get('callInfo');  
                                _self.sfObject.runApex("ypg_ManageObjects","updateF9Task",
                                            'id='+     taskId+'&'
                                            +'calObj='+currentCallInfo.sesId + '&'
                                            +'calTp='+ currentCallInfo.calTp + '&'
                                            +'sesId='+ currentCallInfo.calMSes + '&'
                                            +'cmpId='+ currentCallInfo.campId + '&'
                                            +'cmpName='+currentCallInfo.campNm + '&'
                                            +'calANI='+currentCallInfo.calANI + '&'
                                            +'calDNIS='+currentCallInfo.calDNIS + '&'
                                            +'agExt='+ currentCallInfo.calUsrE + '&'
                                            +'agSkill='+currentCallInfo.calSkill + '&'
                                            +'agFNm='+ currentCallInfo.calFllN + '&'    
                                            +'agUNm='+ currentCallInfo.calUsrN + '&'
                                            +'calHndlTm='+currentCallInfo.calHndlTm+'&'
                                            +'calWrapTm='+currentCallInfo.calWrapTm,_self.onTaskUpdated);     
                        }
                    };
                    this.onUpdateCallDuration =function(response){
                         if(response.result && vis())
                         {
                              var currrentTaskId =  _self.clickTODialModel.get('taskId');    
                              var currentCallInfo =  _self.clickTODialModel.get('callInfo'); 
                              var redirectUrl = '/apex/F9CallDisposition?id='+currrentTaskId+'&cid='+currentCallInfo.callId;
                              console.log('CurrentTab: - '+vis());      
                             _self.sfObject.screenPop(redirectUrl, false);
                         } 
                    };
                    this.onTaskUpdated =  function(response){
                        if(response.result){
                            console.log('ypg-connector.onTaskUpdated'+ response .result);                         
                            var currentCallInfo = _self.clickTODialModel.get('callInfo'); 
                            _self.sfObject.runApex("ypg_ManageObjects","updateCallDurations",'callSId='+currentCallInfo.sesId,_self.onUpdateCallDuration);                                                                            
                        }
                     };
                          
                    this.onUserLockDispo = function(response){
                        if(response.result){
                            console.log('ypg-connector.onUserLockDispo'+ response.result);   
                            var lastCallInfo = _self.clickTODialModel.get('callInfo');  
                            _self.sfObject.runApex("ypg_ManageObjects","createTask",
                                            'rcType= callAdv&'
                                            +'rcStatus=Completed&'
                                            +'rcPriority=Normal&'
                                            +'rcWhatId=&'
                                            +'rcWhoId=&'
                                            +'idSession='+lastCallInfo.sesId+'&'
                                            +'skill=', _self.onTaskCreated);    

                        }
                    };

                    this.onUserUnLockDispo = function(response){
                        if(response.result){
                            console.log('ypg-connector.onUserUnLockDispo'+ response.result);   
                            _self.clickTODialModel.set('callInfo', null); // 
                            _self.clickTODialModel.set('taskId', ''); // 
                        }
                    };
                    this.log('handleCallInfo: agentData: ', JSON.stringify(agentData));
                    this.log('handleCallInfo: EventData: ', JSON.stringify(eventData));
                    if (eventData != null && eventData.context != null) {
                        if(eventData.context.eventReason =='CONNECTED'){
                            if (agentData != null && vis()) {
                                   this.setTheCallInfo(agentData,eventData);
                                    _self.sfObject.runApex("ypg_ManageObjects","F9UserSetCallInfo",
                                            'usrId='+ _self.clickTODialModel.get('sfdcUserId')+'&'
                                            +'sesId='+callInfo.sesId+ '&'
                                            +'campId='+ callInfo.campId + '&'
                                            +'campNm='+ callInfo.campNm + '&'
                                            +'calTp='+callInfo.calTp + '&'
                                            +'calANI='+callInfo.calANI + '&'
                                            +'calDNIS='+callInfo.calDNIS + '&'
                                            +'calMSes='+ callInfo.calMSes + '&'
                                            +'calHOff='+callInfo.calHOff + '&'
                                            +'calUsrN='+ callInfo.calUsrN + '&'
                                            +'calFllN='+ callInfo.calFllN + '&'
                                            +'calUsrE='+callInfo.calUsrE+'&'
                                            +'calTsk=&'
                                            +'calEvnt='+callInfo.calEvnt,_self.onSuccessfulSetCallInfo);   
                                    }
                                }
                            }
                   
                    if (eventData != null && eventData.context != null) {
                         if(eventData.context.eventReason =='DISPOSITIONED'){
                           _self.sfObject.runApex("ypg_ManageObjects","F9UserUnlockForDispo", 'usrId='+_self.clickTODialModel.get('sfdcUserId'),this.onUserUnLockDispo);         
                       }
                   }

                    if (eventData != null && eventData.context != null) {
                        if (_.contains(this.handledEvents, eventData.context.eventReason)) {
                            var endedCallInfo= this.clickTODialModel.get('callInfo'); 
                            if(endedCallInfo == null) {
                                 this.setTheCallInfo(agentData,eventData);
                                 endedCallInfo= this.clickTODialModel.get('callInfo'); 
                            }
                            endedCallInfo.calHndlTm = agentData.attributes.handleTimestamp;
                            endedCallInfo.calWrapTm = agentData.attributes.wrapupTimestamp;
                            this.clickTODialModel.set('callInfo', endedCallInfo); // TODO DEBUG   
                            this.sfObject.runApex("ypg_ManageObjects","F9UserLockForDispo", 'usrId='+this.clickTODialModel.get('sfdcUserId'),this.onUserLockDispo);                                              
                            }
                        }
                    },
                setTheCallInfo:function(agentData,eventData)
                {
                     var callVariables = agentData.get('variables');
                        callInfo.usrId =  this.clickTODialModel.get('sfdcUserId');
                        callInfo.sesId = callVariables[this.getCallVariableByName('Call.session_id').get('id')];
                        callInfo.campId = callVariables[this.getCallVariableByName('Call.campaign_id').get('id')];
                        callInfo.campNm = callVariables[this.getCallVariableByName('Call.campaign_name').get('id')];
                        callInfo.calTp = callVariables[this.getCallVariableByName('Call.type').get('id')];
                        callInfo.calANI = callVariables[this.getCallVariableByName('Call.ANI').get('id')];
                        callInfo.calDNIS = callVariables[this.getCallVariableByName('Call.DNIS').get('id')];
                        callInfo.calMSes = agentData.id;
                        callInfo.calHOff = callVariables[this.getCallVariableByName('Call.number').get('id')];
                        callInfo.calUsrN = callVariables[this.getCallVariableByName('Agent.user_name').get('id')];
                        callInfo.calFllN = callVariables[this.getCallVariableByName('Agent.full_name').get('id')];
                        callInfo.calUsrE = UiApi.Context.Agent.get('extension');
                        callInfo.callId  = agentData.id;
                        callInfo.calSkill = '';
                        callInfo.calTsk = '';
                        callInfo.calEvnt = eventData.context.eventReason;                
                        this.clickTODialModel.set('callInfo', callInfo); 
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
