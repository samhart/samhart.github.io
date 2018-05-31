define('modules/softphone-audio',['ui.api.v1'],

    function (UiApi) {

        var SoftphoneAudio = {};

        var _model;

        SoftphoneAudio.initialize = function () {
            UiApi.Logger.debug('SoftphoneAudio', 'initialize');

            _model = new UiApi.LocalModel({
                name: 'SoftphoneAudioLocalModel',
                sessionId: UiApi.Context.authToken,
                version: '0.01',
                attributes: {
                    lastCaptureVolume: {default: 100, persistence: UiApi.LocalModel.Persistence.Session},
                    lastPlaybackVolume: {default: 100, persistence: UiApi.LocalModel.Persistence.Session}
                }
            });
        };

        SoftphoneAudio.getStationType = function() {
            return UiApi.SharedPresModelRepo.getModel('StationSetupPresModel')
                .getViewAttributes().get('stationType');
        };

        SoftphoneAudio.getLastCaptureVolume = function() {
            return _model.get('lastCaptureVolume');
        };

        SoftphoneAudio.setLastCaptureVolume = function(volume) {
            _model.set('lastCaptureVolume', volume);
        };

        SoftphoneAudio.getLastPlaybackVolume = function() {
            return _model.get('lastPlaybackVolume');
        };

        SoftphoneAudio.setLastPlaybackVolume = function(volume) {
            _model.set('lastPlaybackVolume', volume);
        };

        SoftphoneAudio.getActivePlaybackDevice = function() {
            try {
                var activeDevice = UiApi.Context.AgentStation.softphone().playbackDevices().activeDevice();
                return activeDevice;
            } catch (e) {
                UiApi.Logger.warn('softphone-audio', 'getActivePlaybackDevice', 'unable to identify activeDevice');
            }
        };

        SoftphoneAudio.getActiveCaptureDevice = function() {
            try {
                var activeDevice = UiApi.Context.AgentStation.softphone().captureDevices().activeDevice();
                return activeDevice;
            } catch (e) {
                UiApi.Logger.warn('softphone-audio', 'getActiveCaptureDevice', 'unable to identify activeDevice');
            }
        };

        SoftphoneAudio.setPlaybackVolume = function(volume) {
            UiApi.Logger.debug('softphone-audio', 'setPlaybackVolume', volume);

            var activeDevice = this.getActivePlaybackDevice();
            if (activeDevice) {
                activeDevice.setVolume(Math.round(volume));
            }
        };

        SoftphoneAudio.getPlaybackVolume = function() {
            var volume = 100; // default

            var activeDevice = this.getActivePlaybackDevice();
            if (activeDevice) {
                volume = activeDevice.volume;
            }

            UiApi.Logger.debug('softphone-audio', 'getPlaybackVolume', volume);
            return volume;
        };

        SoftphoneAudio.setCaptureVolume = function(volume) {
            UiApi.Logger.debug('softphone-audio', 'setCaptureVolume', volume);

            var activeDevice = this.getActiveCaptureDevice();
            if (activeDevice) {
                activeDevice.setVolume(Math.round(volume));
            }
        };

        SoftphoneAudio.getCaptureVolume = function() {
            var volume = 100; // default

            var activeDevice = this.getActiveCaptureDevice();
            if (activeDevice) {
                volume = activeDevice.volume;
            }

            UiApi.Logger.debug('softphone-audio', 'getCaptureVolume', volume);
            return volume;
        };

        SoftphoneAudio.getCaptureMute = function() {
            var isMuted = false;

            var activeDevice = this.getActiveCaptureDevice();
            if (activeDevice) {
                isMuted = activeDevice.isMuted;
            }

            UiApi.Logger.debug('softphone-audio', 'getCaptureMute', isMuted);
            return isMuted;
        };

        SoftphoneAudio.setCaptureMute = function(mute) {
            UiApi.Logger.debug('softphone-audio', 'setCaptureMute', mute);

            var activeDevice = this.getActiveCaptureDevice();
            if (activeDevice) {
                activeDevice.mute(mute);
            }
        };

        return SoftphoneAudio;
    });

define('modules/window-message-listener',['ui.api.v1', 'underscore'],

    function (UiApi, _) {

        var MessageListener = {

            listeners: [],

            initialize: function () {
                UiApi.Logger.debug('MessageListener', 'initialize');

                var messageCallback = _.bind(function (event) {
                    if (!!event.data.cmd) {
                        UiApi.Logger.debug('MessageListener', 'receiveMessage', event.data);

                        _.each(this.listeners, function (callback) {
                            try {
                                callback(event);
                            } catch (e)  {
                                UiApi.Logger.warn('MessageListener', 'Error executing callback', e);
                            }
                        });
                    }
                }, this);

                if (typeof window.attachEvent === 'function') {
                    window.attachEvent('message', messageCallback);
                } else if (typeof window.addEventListener === 'function') {
                    window.addEventListener('message', messageCallback, false);
                }
            },

            /**
             * Add listener for window messages
             *
             * @param callback
             */
            addListener: function (callback) {
                if (typeof callback === 'function') {
                    this.listeners.push(callback);
                }
            },

            removeListener: function (callback) {
                if (typeof callback === 'function') {
                    for (var id in this.listeners) {
                        if (callback === this.listeners[id]) {
                            this.listeners.splice(id, 1);
                            break;
                        }
                    }
                }
            }
        };

        return MessageListener;
    });

define('modules/ypConnector',[
        'ui.api.v1',
        'underscore',
        'presentation.models/pres.model.events',
    ],

    function (UiApi, _, Events) {

        var ypConnector = {
            sPageInfo: null,
            sHostName: '',
            taskId: '',
            five9MetaData: null,
            five9CRMRecord: [],
            callInfo: {
                usrId: '',
                sesId: '',
                campId: '',
                campNm: '',
                calTp: '',
                calTpName: '',
                calANI: '',
                calDNIS: '',
                calBPN: '',
                calMSes: '',
                calHOff: '',
                calHndlTm: '',
                calWrapTm: '',
                callId: '',
                calUsrN: '',
                calFllN: '',
                calUsrE: '',
                calSkill: '',
                calTsk: '',
                calEvnt: '',
                taskId: '',
                accountId: '',
                correlationId: ''
            },
            self: null,

            handledEvents: ['DISCONNECTED_BY_AGENT', 'DISCONNECTED_BY_CALLER', 'FAILED_TO_CONNECT', 'WRAP_UP'],
            clickTODialModel: undefined,
            CreateClickTODialModel: function () {
                if (!this.clickTODialModel) {
                    this.clickTODialModel = new UiApi.LocalModel({
                        name: 'CustomClickTODialLocalModel',
                        sessionId: UiApi.Context.authToken,
                        version: '0.01',
                        attributes: {
                            callInfo: { default: null, persistence: UiApi.LocalModel.Persistence.Session },
                            taskId: { default: '', persistence: UiApi.LocalModel.Persistence.Session },
                            sfdcUserId: { default: '', persistence: UiApi.LocalModel.Persistence.Session },
                            five9MetaData: { default: null, persistence: UiApi.LocalModel.Persistence.Session },
                            five9CRMRecord: { default: [], persistence: UiApi.LocalModel.Persistence.Session },
                            five9ApiUrl:{default:'', persistence: UiApi.LocalModel.Persistence.Session}
                        }
                    });
                }
            },
            restCallInfo: function () {
                return {
                    usrId: '',
                    sesId: '',
                    campId: '',
                    campNm: '',
                    calTp: '',
                    calTpName: '',
                    calANI: '',
                    calDNIS: '',
                    calBPN: '',
                    calMSes: '',
                    calHOff: '',
                    calHndlTm: '',
                    calWrapTm: '',
                    callId: '',
                    calUsrN: '',
                    calFllN: '',
                    calUsrE: '',
                    calSkill: '',
                    calTsk: '',
                    calEvnt: '',
                    taskId: '',
                    accountId: '',
                    correlationId: ''
                };
            },
            getDefaultSettings: function () {
                this.onSettingsConsumed = function (response) {
                    if (response.result) {
                        var currentSfdcUserId = response.result;
                        self.clickTODialModel.set('sfdcUserId', currentSfdcUserId);
                    }
                };
                this.sfObject.runApex('ypg_ManageObjects', 'F9GetCurrentUserId', '', this.onSettingsConsumed);
            },
            getpageInfo: function () {
                this.sfObject.getPageInfo(this.setpageInfoData)
            },
            getFive9ApiDetails:function(){
                this.onFive9ApiDetailsConsumed = function (response) {
                    if (response.result) {
                        self.clickTODialModel.set('five9ApiUrl', response.result);
                    }
                };
                this.sfObject.runApex('ypg_ManageObjects', 'getFive9ApiUrl', '', this.onFive9ApiDetailsConsumed);
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
            getCRMContactRecordKeys: function () {
                var domainUrl= '';
                if (self.five9MetaData == null) {
                    self.five9MetaData = self.clickTODialModel.get('five9MetaData');
                }
                if (self.five9MetaData.metadata != null) {
                    if (self.five9MetaData.metadata.dataCenters != null && self.five9MetaData.metadata.dataCenters.length > 0) {
                        if (self.five9MetaData.metadata.dataCenters[0].apiUrls != null && self.five9MetaData.metadata.dataCenters[0].apiUrls.length > 0) {
                            domainUrl ='https://'+ self.five9MetaData.metadata.dataCenters[0].apiUrls[0].host;
                        }
                    }
                }
                self.httpRequest('GET', domainUrl+'/appsvcs/rs/svc/orgs/' + self.five9MetaData.orgId + '/contact_fields', function (response) {
                    console.log('=-=-=-=-' + JSON.stringify(response));
                    self.five9CRMRecord = response;
                    self.clickTODialModel.set('five9MetaData', self.five9MetaData);
                    self.clickTODialModel.set('five9CRMRecord', self.five9CRMRecord);
                }, function (error) {
                    UiApi.Logger.info('getCRMContactRecordKeys error: ' + JSON.stringify(error));
                    self.five9CRMRecord = [];
                })
            },
            getFive9AuthMetaData: function () {
                this.httpRequest('GET',  self.clickTODialModel.get('five9ApiUrl')+'/appsvcs/rs/svc/auth/metadata', function (response) {
                    self.five9MetaData = response;

                }, function (error) {
                    UiApi.Logger.info('getFive9AuthMetaData error: ' + JSON.stringify(error));
                    self.five9MetaData = null;
                    self.five9CRMRecord = [];
                });
            },
            httpRequest: function (type, requestUrl, successCallback, errorCallback) {
                try {
                    $.ajax({
                        type: type,
                        xhrFields: {
                            withCredentials: true
                        },
                        contentType: { "Content-Type": "application/json" },
                        url: requestUrl,
                        success: function (response) {
                            successCallback(response)
                        },
                        error: function (responseData) {
                            errorCallback(responseData);
                        }
                    });
                }
                catch (ex) {
                    UiApi.Logger.info('getFive9AuthMetaData error: ' + JSON.stringify(ex));
                }
            },

            initialize: function () {
                UiApi.Logger.info('ypConnector', 'initialize');
                self = this;
                self.sfObject = UiApi.getSFApiWrapper();
                this.CreateClickTODialModel();
                try {
                    var sfdcIFrameOrigin = decodeURIComponent(location.search).match(/sfdcIFrameOrigin=(.*?)&/)[1];
                    this.getFive9ApiDetails();
                    this.getDefaultSettings();
                    this.getpageInfo();


                } catch (e) {
                    UiApi.Logger.info('sfURL error: ' + e.message);

                }

            },

            getCallVariableByName: function (cavName) {
                return _.find(UiApi.Context.Tenant.CallVariables().models, function (cav) {
                    return cav.get('group') + '.' + cav.get('name') == cavName;
                });
            },

            handleCallInfo: function (agentData, eventData) {
                var me = this;
                me.agentData = agentData;
                me.eventData = eventData;

                this.onSuccessfulGetCallInfo = function (response) {
                    if (response.result) {
                        callInfo = JSON.parse(response.result);
                        callInfo.calEvnt = me.eventData.context.eventReason;
                        self.clickTODialModel.set('callInfo', JSON.parse(callInfo));
                        self.setTheCallInfo(agentData, eventData);
                    }
                    else {
                        if (callInfo == null) {
                            self.setTheCallInfo(me.agentData, me.eventData);
                        }
                        self.sfObject.runApex("ypg_ManageObjects", "F9UserSetCallInfo",
                            'usrId=' + self.clickTODialModel.get('sfdcUserId') + '&'
                            + 'jsonString=' + JSON.stringify(callInfo)
                            , self.onSuccessfulSetCallInfo);
                    }
                },
                    this.onTaskCreated = function (response) {
                        if (response.result) {
                            console.log('ypg-connector.onTaskCreated' + response.result);
                            taskId = response.result;
                            self.clickTODialModel.set('taskId', taskId);
                            var currentCallInfo = self.clickTODialModel.get('callInfo');
                            self.sfObject.runApex("ypg_ManageObjects", "updateF9Task",
                                'id=' + taskId + '&'
                                + 'calObj=' + currentCallInfo.calMSes + '&'
                                + 'calTp=' + currentCallInfo.calTp + '&'
                                + 'calTpName=' + currentCallInfo.calTpName + '&'
                                + 'sesId=' + currentCallInfo.sesId + '&'
                                + 'cmpId=' + currentCallInfo.campId + '&'
                                + 'cmpName=' + currentCallInfo.campNm + '&'
                                + 'calANI=' + currentCallInfo.calANI + '&'
                                + 'calDNIS=' + currentCallInfo.calDNIS + '&'
                                + 'agExt=' + currentCallInfo.calUsrE + '&'
                                + 'agSkill=' + (currentCallInfo.calSkill == undefined ? '' : currentCallInfo.calSkill) + '&'
                                + 'agFNm=' + currentCallInfo.calFllN + '&'
                                + 'agUNm=' + currentCallInfo.calUsrN + '&'
                                + 'calHndlTm=' + currentCallInfo.calHndlTm + '&'
                                + 'calWrapTm=' + currentCallInfo.calWrapTm, me.onTaskUpdated);
                        }
                    };
                this.onSuccessfulUpdateCallinfo = function (response) {
                    if (response.result && vis()) {
                        var currrentTaskId = self.clickTODialModel.get('taskId');
                        var currentCallInfo = self.clickTODialModel.get('callInfo');
                        var redirectUrl = '/apex/F9CallDisposition?id=' + currrentTaskId + '&cid=' + currentCallInfo.callId + '&campid=' + currentCallInfo.campId + '&evtName=' + currentCallInfo.calEvnt + '&bpn=' + currentCallInfo.calBPN;
                        console.log('CurrentTab: - ' + vis());
                        self.sfObject.screenPop(redirectUrl, false);
                    }
                }
                this.onUpdateCallDuration = function (response) {
                    if (response.result) {
                        currentCallInfo.calEvnt = me.eventData.context.eventReason;
                        self.clickTODialModel.set('callInfo', JSON.parse(currentCallInfo));
                        self.sfObject.runApex("ypg_ManageObjects", "F9UserSetCallInfo",
                            'usrId=' + self.clickTODialModel.get('sfdcUserId') + '&'
                            + 'jsonString=' + JSON.stringify(currentCallInfo)
                            , me.onSuccessfulUpdateCallinfo);
                    }
                };
                this.onTaskUpdated = function (response) {
                    if (response.result) {
                        var currentCallInfo = self.clickTODialModel.get('callInfo');
                        console.log('ypg-connector.onTaskUpdated' + response.result)
                        if (me.eventData.context.eventReason == 'CONFERENCE_PARTICIPANT_DISCONNECTED_BY_THEMSELF' || me.eventData.context.eventReason == 'CONFERENCE_PARTICIPANT_DISCONNECTED_BY_AGENT') {
                            self.sfObject.runApex("ypg_ManageObjects", "updateCallDurations", 'callSId=' + currentCallInfo.sesId, me.onUpdateCallDuration);
                        }
                        else {
                            currentCallInfo.calEvnt = me.eventData.context.eventReason;
                            self.clickTODialModel.set('callInfo', currentCallInfo);
                            self.sfObject.runApex("ypg_ManageObjects", "F9UserSetCallInfo",
                                'usrId=' + self.clickTODialModel.get('sfdcUserId') + '&'
                                + 'jsonString=' + JSON.stringify(currentCallInfo)
                                , me.onSuccessfulUpdateCallinfo);
                        }
                    }
                };

                this.onUserLockDispo = function (response) {
                    if (response.result) {
                        console.log('ypg-connector.onUserLockDispo' + response.result);
                        var lastCallInfo = self.clickTODialModel.get('callInfo');
                        self.sfObject.runApex("ypg_ManageObjects", "createTask",
                            'rcType= callAdv&'
                            + 'rcStatus=Completed&'
                            + 'rcPriority=Normal&'
                            + 'rcWhatId=&'
                            + 'rcWhoId=&'
                            + 'idSession=' + lastCallInfo.sesId + '&'
                            + 'skill=', me.onTaskCreated);

                    }
                };

                this.onUserUnLockDispo = function (response) {
                    if (response.result) {
                        console.log('ypg-connector.onUserUnLockDispo' + response.result);
                        callInfo = self.clickTODialModel.get('callInfo');
                        if (callInfo.accountId !== null) {
                            self.sfObject.runApex("ypg_ManageObjects", "setInContact", 'accId=' + callInfo.accountId + '&value=false', self.onSuccessfulSetInContact);
                        }
                        self.clickTODialModel.set('callInfo', null);
                        self.callInfo = self.restCallInfo();
                        self.clickTODialModel.set('callInfo', null); //
                        self.clickTODialModel.set('taskId', ''); //
                    }
                };
                UiApi.Logger.info('handleCallInfo: agentData: ', JSON.stringify(agentData));
                UiApi.Logger.info('handleCallInfo: EventData: ', JSON.stringify(eventData));
                if (eventData != null && eventData.context != null) {
                    if (eventData.context.eventReason == 'CONNECTED' || eventData.context.eventReason == 'UPDATED') {
                        if (agentData != null){ //&& vis()) {
                            if (UiApi.Context.Tenant.CallVariables().models.length > 0) {
                                self.setTheCallInfo(agentData, eventData);
                                callInfo = self.clickTODialModel.get('callInfo');
                                self.sfObject.runApex("ypg_ManageObjects", "F9UserSetCallInfo",
                                    'usrId=' + self.clickTODialModel.get('sfdcUserId') + '&'
                                    + 'jsonString=' + JSON.stringify(callInfo)
                                    , self.onSuccessfulSetCallInfo);
                            }
                            else {
                                setTimeout(function () {
                                    self.setTheCallInfo(agentData, eventData);
                                    callInfo = self.clickTODialModel.get('callInfo');
                                    self.sfObject.runApex("ypg_ManageObjects", "F9UserSetCallInfo",
                                        'usrId=' + self.clickTODialModel.get('sfdcUserId') + '&'
                                        + 'jsonString=' + JSON.stringify(callInfo)
                                        , self.onSuccessfulSetCallInfo);
                                }, 2000);
                            }
                        }
                    }
                    if (eventData.context.eventReason == 'DISPOSITIONED' || eventData.context.eventReason == 'AFTER_CALL_WORK_TIME_EXPIRED' || eventData.context.eventReason == 'TRANSFERRED') {
                        self.sfObject.runApex("ypg_ManageObjects", "F9UserUnlockForDispo", 'usrId=' + self.clickTODialModel.get('sfdcUserId').substring(0, self.clickTODialModel.get('sfdcUserId').length - 3), me.onUserUnLockDispo);
                    }
                    if (eventData.context.eventReason == 'RECORDING_INFO_UPDATED') {
                        var callVariables = agentData.get('variables');
                        callInfo = self.clickTODialModel.get('callInfo');
                        if (callInfo != null) {
                            callInfo.calHOff = callVariables[self.getCallVariableByName('Customer.number1').get('id')];
                            //callInfo.accountId = callVariables[self.getCallVariableByName('Salesforce.salesforce_id').get('id')];
                            self.clickTODialModel.set('callInfo', callInfo);
                        }
                    }
                    if (eventData.context.eventReason == 'CONFERENCE_PARTICIPANT_DISCONNECTED_BY_THEMSELF' || eventData.context.eventReason == 'CONFERENCE_PARTICIPANT_DISCONNECTED_BY_AGENT') {
                        self.callInfo = self.clickTODialModel.get('callInfo');
                        self.callInfo.correlationId = eventData.context.correlationId;
                        self.clickTODialModel.set('callInfo', self.callInfo);
                    }
                    if (_.filter(self.handledEvents, function (item) { return item === eventData.context.eventReason }).length > 0 && self.callInfo.correlationId != eventData.context.correlationId) {
                        var endedCallInfo = self.clickTODialModel.get('callInfo');
                        if (endedCallInfo != null && vis()) {
                            endedCallInfo.calHndlTm = agentData.attributes.handleTime;
                            endedCallInfo.calWrapTm = agentData.attributes.wrapupTime;
                            self.clickTODialModel.set('callInfo', endedCallInfo);
                            self.sfObject.runApex("ypg_ManageObjects", "F9UserLockForDispo", 'usrId=' + self.clickTODialModel.get('sfdcUserId'), me.onUserLockDispo);
                        }
                        else {
                            UiApi.Logger.info('HandledEvents:: CallInfo not set');
                        }
                    }
                }
            },
            onSuccessfulSetInContact: function (response) {
                if (response.result) {
                    UiApi.Logger.info('onSuccessfulSetInContact: success');
                }
            },

            onSuccessfulSetCallInfo: function (response) {
                if (response.result) {
                    callInfo = self.clickTODialModel.get('callInfo');
                    if (callInfo != null && callInfo.accountId != null && self.clickTODialModel.get('sfdcUserId') !== null) {
                        self.sfObject.runApex("ypg_ManageObjects", "setInContact", 'accId=' + callInfo.accountId + '&value=true', self.onSuccessfulSetInContact);
                    }
                }
            },
            setTheCallInfo: function (agentData, eventData) {
                var callVariables = agentData.get('variables');
                self.callInfo.usrId = self.clickTODialModel.get('sfdcUserId');
                self.callInfo.sesId = callVariables[self.getCallVariableByName('Call.session_id').get('id')];
                self.callInfo.campId = callVariables[self.getCallVariableByName('Call.campaign_id').get('id')];
                self.callInfo.campNm = callVariables[self.getCallVariableByName('Call.campaign_name').get('id')];
                //self.callInfo.calTpName = agentData.attributes.callType;
                self.callInfo.calTpName = callVariables[self.getCallVariableByName('Call.type_name').get('id')];
                self.callInfo.calTp = callVariables[self.getCallVariableByName('Call.type').get('id')];
                self.callInfo.calANI = callVariables[self.getCallVariableByName('Call.ANI').get('id')];
                self.callInfo.calDNIS = callVariables[self.getCallVariableByName('Call.DNIS').get('id')];
                self.callInfo.calBPN = callVariables[self.getCallVariableByName('Single IVR.GET_BIZ_NUMBER_ENTERED_DIGITS').get('id')];
                self.callInfo.calMSes = agentData.id;
                self.callInfo.calHOff = callVariables[self.getCallVariableByName('Customer.number1').get('id')];
                self.callInfo.calUsrN = callVariables[self.getCallVariableByName('Agent.user_name').get('id')];
                self.callInfo.calFllN = callVariables[self.getCallVariableByName('Agent.full_name').get('id')];
                self.callInfo.calUsrE = UiApi.Context.Agent.get('extension');
                self.callInfo.callId = agentData.id;
                self.callInfo.calSkill = callVariables[self.getCallVariableByName('Call.skill_name').get('id')];
                if (self.five9CRMRecord.length == 0) {
                    self.five9CRMRecord = self.clickTODialModel.get('five9CRMRecord');
                }
                var obj_salesforce_id = _.find(self.five9CRMRecord, function (item) { return item.name == 'salesforce_id' });
                if (Five9.Context.Agent.Calls().models.length > 0)
                    self.callInfo.accountId = Five9.Context.Agent.Calls().models[0].attributes.activeContact.fields[obj_salesforce_id.id];
                //callVariables[self.getCallVariableByName('Salesforce.salesforce_id').get('id')];
                self.callInfo.calTsk = '';
                self.callInfo.calEvnt = eventData.context.eventReason;
                self.clickTODialModel.set('callInfo', self.callInfo);
            },
            onModelLoad: function () {
                UiApi.Logger.info('ypConnector', 'onModelLoad');
                //    UiApi.vent.on(Events.CRMClick2Dial, _.bind(this.onClickToDial, this));
                if (UiApi.Context.Agent) {
                    if (this.five9MetaData == null)
                        this.getFive9AuthMetaData();
                    UiApi.Logger.info('onModelLoad', 'checking listeners.');
                    UiApi.Root.Agent(UiApi.Context.AgentId).LoginState().on('change:state', this.onLoginStateChange);
                    //if (!UiApi.Root.Agent(UiApi.Context.AgentId).Call()._events) {
                        UiApi.Root.Agent(UiApi.Context.AgentId).Call().on('add change', this.handleCallInfo);
                    //}
                }
            },
            onLoginStateChange: function (model) {
                if (model.state() == 'WORKING')
                    self.getCRMContactRecordKeys();
            },
            onModelUnload: function () {
                UiApi.Logger.info('ypConnector', 'onModelUnload');
                UiApi.Root.Agent(UiApi.Context.AgentId).Call().off('add change', this.handleCallInfo);
                UiApi.Root.Agent(UiApi.Context.AgentId).LoginState().off('change:state', this.onLoginStateChange);
            }
        };
        return ypConnector;
    });



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


var vis = (function () {
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
    return function (c) {
        if (c) document.addEventListener(eventKey, c);
        return !document[stateKey];
    }
})();
define('workflow/init',['ui.api.v1', 'modules/softphone-audio', 'modules/window-message-listener', 'modules/ypConnector'],
    function (UiApi, SoftphoneAudio, MessageListener,ypConnector) {
        return {
            initialize: function () {
                //Place your library initialization code here
                UiApi.Logger.debug('init:workflow:initialize');
                MessageListener.initialize();
                SoftphoneAudio.initialize();
                UiApi.Logger.debug('ypConnector:workflow:initialize');
                ypConnector.initialize();
            },

            onModelLoad: function () {
                //Place your server model subscription code here
                UiApi.Logger.debug('init:workflow:onModelLoad');
                UiApi.Logger.debug('ypConnector:workflow:onModelLoad');
                ypConnector.onModelLoad();
            },

            onModelUnload: function () {
                //Place your cleanup code here
                UiApi.Logger.debug('init:workflow:onModelUnload');
                UiApi.Logger.debug('ypConnector:workflow:onModelUnload');
                ypConnector.onModelUnload();
            }
        };
    });

define('presentation.models/call-middle.pres.model',[
        'ui.api.v1',
        'localize',
        'underscore',
        'api/api.errors',
        'modules/softphone-audio',
        'modules/window-message-listener',
        'models/server/callConstants',
        'models/server/permissionsConstants',
        'models/server/calls'],
    function (UiApi, Localize, _, ApiErrors, SoftphoneAudio, MessageListener, CallConstants, PermissionsConstants, Calls) {
        return UiApi.PresentationModel.extend({
            initialize: function (params) {
                UiApi.Logger.debug('secure-payment', 'initialize v1.1.1');
                var locale = Localize.getLocale();
                UiApi.Logger.debug('secure-payment', 'initialize', 'locale = ' + locale);

                this.onConfCallStateChange = _.bind(function (model, newState) {
                    UiApi.Logger.debug('secure-payment', 'confCallModel', 'change:state', newState);
                    switch (newState) {
                        case CallConstants.State.ParticipantTalking:
                            var isActive = this.getViewAttributes().get('isActive');
                            //if (isActive) SoftphoneAudio.setCaptureMute(true);
                            break;
                        case CallConstants.State.Finished:
                            // clear conference participant disconnected message
                            ApiErrors.clearAll();
                            this.stopPaymentIVR();
                            break;
                    }
                }, this);

                var callModel = UiApi.Root.Agent(UiApi.Context.AgentId).Call(params.callId);
                var allCallsModel = UiApi.Root.Agent(UiApi.Context.AgentId).Calls();
                var callVariables = UiApi.Context.Tenant.CallVariables();
                var campaigns = UiApi.Context.Tenant.Campaigns();
                var agentPermissions = UiApi.Root.Agent(UiApi.Context.AgentId).Permissions();

                allCallsModel.on('add', _.bind(function(model) {
                    if (this.isConferenceCall(model)) {
                        this.setConfCallModel(model);
                        var confId = model.get('id');
                        UiApi.Logger.debug('secure-payment', 'allCallsModel', 'add', confId);
                        model.on('change:state', this.onConfCallStateChange);
                    }
                }, this));

                callModel.on('change:state', _.bind(function (model, newState) {
                    var callId = model.get('id');
                    UiApi.Logger.debug('secure-payment', 'callModel', 'change:state', newState, callId);
                    window.top.postMessage({ cmd: 'callevent', status: newState, callId: callId }, '*');

                    switch (newState) {
                        case CallConstants.State.Offered:
                            break;
                        case CallConstants.State.Talking:
                            break;
                        case CallConstants.State.Acw:
                            this.stopPaymentIVR();
                            break;
                        case CallConstants.State.Finished:
                            break;
                    }
                }, this));

                //UiApi.Root.Agent(UiApi.Context.AgentId).Permissions().fetch().done(function (permissions){
                //    UiApi.Logger.debug('secure-payment', 'initialize', 'fetch Permissions');
                    //this.agentAutoRecord = permissions.isAllowed(Permissions.AgentAutoRecord);
                    //this.agentCanMakeRecordings = permissions.isAllowed(Permissions.MakeRecordings)
                //});

                var viewAttributes = new UiApi.LocalModel({
                    name: 'CallMiddleLocalModel',
                    sessionId: params.callId,
                    version: '0.01',
                    attributes: {
                        locale: {default: locale, persistence: UiApi.LocalModel.Persistence.Session},
                        isActive: {default: false, persistence: UiApi.LocalModel.Persistence.Session},
                        resumeRecording: {default: false, persistence: UiApi.LocalModel.Persistence.Session},
                        countDown: {default: 0, persistence: UiApi.LocalModel.Persistence.Session},
                        timerId: {default: undefined, persistence: UiApi.LocalModel.Persistence.Session}
                    }
                });

                var paymentAttributes = new UiApi.LocalModel({
                    name: 'PaymentIvrLocalModel',
                    sessionId: UiApi.Context.authToken,
                    version: '0.01',
                    attributes: {
                        paymentIvrCavName: {default: 'Custom.PaymentIVR_campaign',persistence: UiApi.LocalModel.Persistence.Session},
                        paymentIvrCavId: {default: undefined, persistence: UiApi.LocalModel.Persistence.Session},
                        paymentIvrCampaignName: {default: undefined, persistence: UiApi.LocalModel.Persistence.None},
                        paymentIvrCampaignId: {default: undefined, persistence: UiApi.LocalModel.Persistence.None},
                        capturePaymentTimeoutCavName: {default: 'Custom.CapturePaymentTimeout',persistence: UiApi.LocalModel.Persistence.Session},
                        capturePaymentTimeoutCavId: {default: undefined, persistence: UiApi.LocalModel.Persistence.Session},
                        capturePaymentTimeoutValue: {default: undefined, persistence: UiApi.LocalModel.Persistence.None},
                        capturePaymentLogCavName: {default: 'Custom.CapturePaymentLog',persistence: UiApi.LocalModel.Persistence.Session},
                        capturePaymentLogCavId: {default: undefined, persistence: UiApi.LocalModel.Persistence.Session},
                        capturePaymentLogValue: {default: undefined, persistence: UiApi.LocalModel.Persistence.None}
                    }
                });

                var options = {};

                options.sourceModel = new UiApi.ModelAggregator([
                    {key: 'call', model: callModel},
                    {key: 'calls', model: allCallsModel},
                    {key: 'confCall', model: null},
                    {key: 'callVariables', model: callVariables},
                    {key: 'campaigns', model: campaigns},
                    {key: 'viewAttributes', model: viewAttributes},
                    {key: 'paymentAttributes', model: paymentAttributes},
                    {key: 'agentPermissions', model:agentPermissions}
                ]);

                options.computedAttributes = {
                    securePayVisible: this.computeSecurePayVisible,
                    securePayState: this.computeSecurePayState,
                    VoiceSignatureButtonText: this.computeVoiceSignatureButtonText,
                    CapturePaymentButtonText: this.computeCapturePaymentButtonText,
                    countdownTimerVisible: this.computeCountdownTimerVisible,
                    btnVoiceSignatureState: this.computeVoiceSignatureState,
                    btnVoiceSignatureEnabled: this.computeVoiceSignatureEnabled,
                    btnCapturePaymentState: this.computeCapturePaymentState,
                    btnCapturePaymentEnabled: this.computeCapturePaymentEnabled,
                    seconds: this.computeSeconds
                };

                this._init(options);

                if (viewAttributes.attributes.timerId) {
                    this.clearTimer();
                    var timerId = this.startTimer();
                    viewAttributes.attributes.timerId = timerId;
                }

                this.messageCallback = _.bind(function (event) {
                    if (!!event.data.cmd) {
                        UiApi.Logger.debug('secure-payment', 'receiveMessage', event.data);

                        switch (event.data.cmd) {
                            case 'startPaymentIVR':
                                this.startPaymentIVR(event.data.data);
                                break;

                            case 'stopPaymentIVR':
                                this.stopPaymentIVR();
                                break;
                        }
                    }
                }, this);
                MessageListener.addListener(this.messageCallback);

                window.top.postMessage({ cmd: 'paymentIVR', status: 'ready',
                    agentId: UiApi.Context.AgentId, tenantId: UiApi.Context.TenantId }, '*');

                window.top.postMessage({ cmd: 'callevent', status: callModel.get('state'), callId: callModel.get('id') }, '*');
            },

            onPreCompute: function () {
                if(this.isFirstPreCompute()) {

                    this.getAllCalls().fetch().done(_.bind(function () {
                        // retrieve conference call
                        var model = this.getConferenceCall();
                        if (!!model) {
                            UiApi.Logger.debug('secure-payment', 'onPreCompute', 'confCallModel', model.get('id'));
                            this.setConfCallModel(model);
                            model.on('change:state', this.onConfCallStateChange);
                        }
                    }, this));

                    this.getCallVariables().fetch().done(_.bind(function () {
                        // retrieve payment IVR cav.id
                        var paymentIvrCampaignName, paymentIvrCampaignId;
                        var paymentIvrCavName = this.getPaymentAttributes().get('paymentIvrCavName');
                        if (paymentIvrCavName) {
                            var cav = this.getCallVariableByName(paymentIvrCavName);
                            if (cav) {
                                var paymentIvrCavId = cav.get('id');
                                UiApi.Logger.debug('secure-payment', 'onPreCompute', 'callVariables',
                                    'paymentIvrCavName', paymentIvrCavName, 'paymentIvrCavId', paymentIvrCavId);
                                this.getPaymentAttributes().set('paymentIvrCavId', paymentIvrCavId);

                                // retrieve payment IVR campaign.id and name
                                paymentIvrCampaignName = this.getCallModel().get('variables')[paymentIvrCavId];
                                if (paymentIvrCampaignName) {
                                    var campaign = this.getCampaignByName(paymentIvrCampaignName);
                                    if (campaign) {
                                        paymentIvrCampaignId = campaign.get('id');
                                    }
                                }
                            }
                        }
                        UiApi.Logger.debug('secure-payment', 'onPreCompute', 'getCallVariables', 'paymentIvrCampaignName: ' + paymentIvrCampaignName, 'paymentIvrCampaignId' + paymentIvrCampaignId);
                        this.getPaymentAttributes().set('paymentIvrCampaignName', paymentIvrCampaignName);
                        this.getPaymentAttributes().set('paymentIvrCampaignId', paymentIvrCampaignId);

                        // retrieve capturePaymentTimeout Cav and value
                        var capturePaymentTimeoutValue;
                        var capturePaymentTimeoutCavName = this.getPaymentAttributes().get('capturePaymentTimeoutCavName');
                        if (capturePaymentTimeoutCavName) {
                            var cav = this.getCallVariableByName(capturePaymentTimeoutCavName);
                            if (cav) {
                                var capturePaymentTimeoutCavId = cav.get('id');
                                UiApi.Logger.debug('secure-payment', 'onPreCompute', 'callVariables',
                                    'capturePaymentTimeoutCavName', capturePaymentTimeoutCavName, 'capturePaymentTimeoutCavId', capturePaymentTimeoutCavId);
                                this.getPaymentAttributes().set('capturePaymentTimeoutCavId', capturePaymentTimeoutCavId);

                                // retrieve capturePaymentTimeout value
                                capturePaymentTimeoutValue = this.getCallModel().get('variables')[capturePaymentTimeoutCavId];
                            }
                        }
                        this.getPaymentAttributes().set('capturePaymentTimeoutValue', capturePaymentTimeoutValue);

                        // retrieve capturePaymentLog Cav and value
                        var capturePaymentLogValue;
                        var capturePaymentLogCavName = this.getPaymentAttributes().get('capturePaymentLogCavName');
                        if (capturePaymentLogCavName) {
                            var cav = this.getCallVariableByName(capturePaymentLogCavName);
                            if (cav) {
                                var capturePaymentLogCavId = cav.get('id');
                                UiApi.Logger.debug('secure-payment', 'onPreCompute', 'callVariables',
                                    'capturePaymentLogCavName', capturePaymentLogCavName, 'capturePaymentLogCavId', capturePaymentLogCavId);
                                this.getPaymentAttributes().set('capturePaymentLogCavId', capturePaymentLogCavId);

                                // retrieve capturePaymentLog value
                                capturePaymentLogValue = this.getCallModel().get('variables')[capturePaymentLogCavId];
                            }
                        }
                        this.getPaymentAttributes().set('capturePaymentLogValue', capturePaymentLogValue);

                        UiApi.Logger.debug('secure-payment', 'onPreCompute',
                            'paymentIvrCampaignName', paymentIvrCampaignName,
                            'paymentIvrCampaignId', paymentIvrCampaignId,
                            'capturePaymentTimeoutValue', capturePaymentTimeoutValue,
                            'capturePaymentLogValue', capturePaymentLogValue);

                    }, this));
                }
            },

            getCallModel: function () {
                return this.get('sourceModel').get('call');
            },

            setConfCallModel: function (call) {
                return this.get('sourceModel').set('confCall', call);
            },

            getConfCallModel: function () {
                return this.get('sourceModel').get('confCall');
            },

            getAllCalls: function () {
                return this.get('sourceModel').get('calls');
            },

            getCallVariables: function () {
                return this.get('sourceModel').get('callVariables');
            },

            getCampaigns: function () {
                return this.get('sourceModel').get('campaigns');
            },

            getViewAttributes: function () {
                return this.get('sourceModel').get('viewAttributes');
            },

            getPaymentAttributes: function () {
                return this.get('sourceModel').get('paymentAttributes');
            },

            computeSecurePayVisible: function () {
                return (this.getCallModel().get('state') != CallConstants.State.Offered);
            },

            computeSecurePayState: function () {
                var locale = Localize.getLocale();
                if (this.isPaymentIVRActive()) {
                    if (locale && locale == 'fr-CA') {
                        return 'Signature Vocale en cours';
                    }
                    return 'Voice Signature Capture started';
                } else if (this.computeCountdownTimerVisible() && !this.isCallRecording()){
                    if (locale && locale == 'fr-CA') {
                        return 'Saisie des Infos de Paiement en cours'
                    }
                    return 'Payment Capture In Progress'
                } else {
                    return '';
                }
            },

            computeVoiceSignatureState: function () {
                if (this.getCallModel().get('state') === CallConstants.State.Talking && !this.isPaymentIVRActive()){
                    return 'full-width btn-green';
                } else {
                    return 'full-width btn-red'
                }
            },

            computeVoiceSignatureEnabled: function () {
                var paymentIVRCampaignId = this.getPaymentAttributes().get('paymentIvrCampaignId');
                UiApi.Logger.debug('secure-payment', 'computeVoiceSignatureEnabled', 'paymentIVRCampaignId: ' + paymentIVRCampaignId);
                return (this.getCallModel().get('state') === CallConstants.State.Talking)
                    && paymentIVRCampaignId != undefined
                    && !this.computeCountdownTimerVisible();
            },

            computeCapturePaymentState: function () {
                UiApi.Logger.debug('secure-payment', 'computeCapturePaymentState', 'isCallRecording: ' + this.isCallRecording());
                if (this.isCallRecording()) {
                    return 'full-width btn-green';
                } else {
                    return 'full-width btn-red';
                }
            },

            computeCapturePaymentEnabled: function () {
                var agentAutoRecord = this.isAgentAutoRecord();
                var agentCanMakeRecordings = this.agentCanMakeRecordings();
                var currentState = this.getCallModel().get('state');
                var callAutoRecording = this.isCallAutoRecording();
                var recordingAllowed = this.isCallRecordingAllowed();

                UiApi.Logger.debug('secure-payment', 'computeCapturePaymentEnabled', 'agentAutoRecord: ' + agentAutoRecord, 'currentState: ' + currentState, 'isCallAutoRecording: ' + callAutoRecording, 'isRecordingAllowed: ' + recordingAllowed);

                $('#btn_CapturePayment').blur();

                return (currentState === CallConstants.State.Talking)
                    && !agentAutoRecord
                    && agentCanMakeRecordings
                    && callAutoRecording
                    && recordingAllowed
                    && !this.isPaymentIVRActive();
            },

            computeSeconds: function () {
                return this.getViewAttributes().get('countDown');
            },

            computeCountdownTimerVisible: function(){
                return this.getViewAttributes().get('timerId');
            },

            computeVoiceSignatureButtonText: function(){
                var locale = Localize.getLocale();
                if (locale && locale == 'fr-CA') {
                    return 'Signature Vocale';
                }
                return 'Voice Signature';
            },

            computeCapturePaymentButtonText: function(){
                var locale = Localize.getLocale();
                if (locale && locale == 'fr-CA') {
                    return 'Infos de Paiement';
                }
                return 'Capture Payment';
            },

            logCallRecordingEvent: function (event) {
                var mainCall = this.getCallModel();
                var timestamp = $('#active-call-time-counter > i').text();
                UiApi.Logger.debug('secure-payment', 'logCallRecordingEvent', event, 'timestamp', timestamp);

                var capturePaymentLog = this.getPaymentAttributes().get('capturePaymentLogValue');
                UiApi.Logger.debug('secure-payment', 'logCallRecordingEvent', event, 'get capturePaymentLog', capturePaymentLog);
                if (!capturePaymentLog) {
                    capturePaymentLog = "";
                }

                capturePaymentLog+= event + ":" + timestamp + "|";
                this.getPaymentAttributes().set('capturePaymentLogValue', capturePaymentLog);
                UiApi.Logger.debug('secure-payment', 'logCallRecordingEvent', event, 'set capturePaymentLog', capturePaymentLog);

                var capturePaymentLogCavName = this.getPaymentAttributes().get('capturePaymentLogCavName');
                if (capturePaymentLogCavName) {
                    var cav = this.getCallVariableByName(capturePaymentLogCavName);
                    if (cav) {
                        var capturePaymentLogCavId = cav.get('id');
                        UiApi.Logger.debug('secure-payment', 'logCallRecordingEvent', event, 'setCallVariable', 'capturePaymentLogCavId', capturePaymentLogCavId, 'value', capturePaymentLog);
                        mainCall.setCallVariable(capturePaymentLogCavId, capturePaymentLog);
                    }
                }
            },

            /**
             * Toggles the call recording (if enabled)
             */
            toggleCallRecording: function () {
                var mainCall = this.getCallModel();

                if (this.isCallRecording()) {
                    var timeout = this.getPaymentAttributes().get('capturePaymentTimeoutValue');
                    if (!timeout){
                        timeout = 30;
                    }
                    UiApi.Logger.debug('secure-payment', 'toggleCallRecording', 'Begin', 'timeout', timeout);

                    this.logCallRecordingEvent("Begin");
                    mainCall.stopRecording();
                    this.initializeTimer(timeout);

                } else {
                    UiApi.Logger.debug('secure-payment', 'toggleCallRecording', 'End');
                    this.logCallRecordingEvent("End");
                    mainCall.startRecording();
                    this.clearTimer();
                }
            },

            //  count-down timer fucntion
            initializeTimer: function(seconds) {
                if (!this.getViewAttributes().get('timerId')) {
                    this.clearTimer();
                    this.getViewAttributes().set('countDown', seconds);
                }
                var timerId = this.startTimer();
                this.getViewAttributes().set('timerId', timerId);
            },

            startTimer: function() {
                return setInterval(_.bind(function(){
                    var tick = this.getViewAttributes().get('countDown');
                    this.getViewAttributes().set('countDown', --tick);
                    if (tick <= 0) {
                        var mainCall = this.getCallModel();
                        this.logCallRecordingEvent("Timeout");
                        mainCall.startRecording();
                        this.clearTimer();
                    }
                }, this), 1000);
            },

            clearTimer: function() {
                var timerId = this.getViewAttributes().get('timerId');
                if(!!timerId){
                    clearInterval(timerId);
                    this.getViewAttributes().set('timerId', undefined);
                }
            },

            /**
             * Starts the Voice Signature Capture by conferencing in the 'Voice Signature' campaign
             * @param data Object containing additional CAVs to attach to the call
             */
            toggleVoiceSignature: function(data){
                var isPaymentIVRActive = this.isPaymentIVRActive();
                UiApi.Logger.debug('secure-payment', 'toggleVoiceSignature', 'isPaymentIVRActive', isPaymentIVRActive);
                if (!isPaymentIVRActive){
                    this.startPaymentIVR(data);
                } else {
                    this.stopPaymentIVR();
                }
            },

            /**
             * Starts the payment IVR by conferencing in the payment campaign
             * @param data Object containing additional CAVs to attach to the call
             */
            startPaymentIVR: function (data) {
                var isActive = this.getViewAttributes().get('isActive');
                var paymentIvrCampaignId = this.getPaymentAttributes().get('paymentIvrCampaignId');
                UiApi.Logger.debug('secure-payment', 'startPaymentIVR', 'isActive', isActive,
                    'paymentIvrCampaignId', paymentIvrCampaignId);

                if (!isActive) {
                    // sanity check
                    if (!paymentIvrCampaignId) {
                        UiApi.Logger.warn('secure-payment', 'startPaymentIVR', 'paymentIvrCampaignId is undefined!');
                        return;
                    }

                    //UiApi.Logger.debug('secure-payment', 'startPaymentIVR', 'setCaptureMute', true);
                    //SoftphoneAudio.setCaptureMute(true);

                    var volume = SoftphoneAudio.getPlaybackVolume();
                    if (volume > 0) {
                        UiApi.Logger.debug('secure-payment', 'startPaymentIVR', 'setLastPlaybackVolume', volume);
                        SoftphoneAudio.setLastPlaybackVolume(volume);
                    }
                    //SoftphoneAudio.setPlaybackVolume(0);

                    var mainCall = this.getCallModel();
                    if (mainCall) {
                        // attach some data for payment ivr usage
                        var variables = {};
                        var cav, id;

                        var mainSessionId = mainCall.get('id');
                        UiApi.Logger.debug('secure-payment', 'startPaymentIVR', 'Custom.mainSessionId', mainSessionId);
                        cav = this.getCallVariableByName('Custom.mainSessionId');
                        if (cav) {
                            id = cav.get('id');
                            UiApi.Logger.debug('secure-payment', 'startPaymentIVR', 'id', id + ' -> ' + mainSessionId);
                            variables[id] = mainSessionId;
                        }

                        var callIdCav = this.getCallVariableByName('Call.call_id');
                        if (callIdCav) {
                            try {
                                var mainCallId = mainCall.get('variables')[callIdCav.get('id')];
                                UiApi.Logger.debug('secure-payment', 'startPaymentIVR', 'Custom.mainCallId', mainCallId);

                                cav = this.getCallVariableByName('Custom.mainCallId');
                                if (cav) {
                                    id = cav.get('id');
                                    UiApi.Logger.debug('secure-payment', 'startPaymentIVR', 'id', id + ' -> ' + mainCallId);
                                    variables[id] = mainCallId;
                                }
                            } catch (e) {}
                        }

                        for (var key in data) {
                            if (!data.hasOwnProperty(key)) continue;
                            var val = data[key];
                            key = (key.indexOf('.') > -1 ? key : 'Custom.' + key);
                            UiApi.Logger.debug('secure-payment', 'startPaymentIVR', 'data', key + '=' + val);
                            if (val == undefined || val == '') continue;
                            cav = this.getCallVariableByName(key);
                            if (cav) {
                                id = cav.get('id');
                                UiApi.Logger.debug('secure-payment', 'startPaymentIVR', 'id', id + ' -> ' + val);
                                variables[id] = val;
                            }
                        }
                        mainCall.setCallVariables(variables);

                        UiApi.Logger.debug('secure-payment', 'startPaymentIVR', 'conferenceAddCampaign', paymentIvrCampaignId);
                        mainCall.conferenceAddCampaign(paymentIvrCampaignId, false);

                        this.getViewAttributes().set('isActive', true);
                        window.top.postMessage({ cmd: 'paymentIVR', status: 'started' }, '*');
                    }
                }
            },

            /**
             * Stops the payment IVR application,
             * disconnecting the conference and restores recording
             */
            stopPaymentIVR: function () {
                var isActive = this.getViewAttributes().get('isActive');
                UiApi.Logger.debug('secure-payment', 'stopPaymentIVR', 'isActive', isActive);

                if (!isActive) return;

                UiApi.Logger.debug('secure-payment', 'stopPaymentIVR', 'setCaptureMute', false);
                SoftphoneAudio.setCaptureMute(false);
                UiApi.Logger.debug('secure-payment', 'stopPaymentIVR', 'setPlaybackVolume', SoftphoneAudio.getLastPlaybackVolume());
                SoftphoneAudio.setPlaybackVolume(SoftphoneAudio.getLastPlaybackVolume());

                var mainCall = this.getCallModel();
                if (mainCall) {
                    UiApi.Logger.debug('secure-payment', 'stopPaymentIVR', 'mainCallId', mainCall.get('id'));
                    var mainCallState = mainCall.get('state');
                    UiApi.Logger.debug('secure-payment', 'stopPaymentIVR', 'mainCallState', mainCallState);
                    var confCall = this.getConfCallModel();
                    if (!!confCall && confCall.get('state') != CallConstants.State.Finished) {
                        UiApi.Logger.debug('secure-payment', 'stopPaymentIVR', 'disconnectParticipant');
                        confCall.disconnectParticipant();
                    }

                    // TODO retrieve payment IVR response, if needed

                    this.getViewAttributes().set('isActive', false);
                    window.top.postMessage({ cmd: 'paymentIVR', status: 'finished' }, '*');
                }
            },

            isCallRecording: function(){
                var mainCall = this.getCallModel();
                return (mainCall.get('recording'));
            },

            isCallAutoRecording: function(){
                var mainCall = this.getCallModel();
                return (mainCall.get('autoRecording'));
            },

            isCallRecordingAllowed: function(){
                var mainCall = this.getCallModel();
                return (mainCall.get('recordingAllowed'));
            },

            isPaymentIVRActive: function () {
                var confCall = this.getConfCallModel();
                return (!!confCall &&
                (confCall.get('state') === CallConstants.State.ParticipantRinging
                || confCall.get('state') === CallConstants.State.ParticipantTalking
                || confCall.get('state') === CallConstants.State.ParticipantConsulting));
            },

            isConferenceCall: function (call) {
                return (!!call && call.get('callType') === CallConstants.Type.Internal
                && call.get('addressType') !== Calls.AddressTypes.External
                && call.get('dnis') === 'campaign:' + this.getPaymentAttributes().get('paymentIvrCampaignName'));
            },

            isAgentAutoRecord: function(){
                var agentAutoRecord = this.get('sourceModel').get('agentPermissions').isAllowed(PermissionsConstants.AgentAutoRecord);
                UiApi.Logger.debug('secure-payment','agentPermissions', "agentAutoRecord = (" + agentAutoRecord + ")");
                return agentAutoRecord;
            },

            agentCanMakeRecordings: function(){
                var agentCanMakeRecordings = this.get('sourceModel').get('agentPermissions').isAllowed(PermissionsConstants.MakeRecordings);
                UiApi.Logger.debug('secure-payment','agentPermissions', "agentCanMakeRecordings = (" + agentCanMakeRecordings + ")");
                return agentCanMakeRecordings;
            },

            getConferenceCall: function () {
                return _.find(this.getAllCalls().models, function(call) {
                    return this.isConferenceCall(call);
                }, this);
            },

            getCallVariableByName: function (cavName) {
                var parts = (cavName || '').split('.');
                if (parts.length === 2) {
                    return _.find(this.getCallVariables().models, function(cav) {
                        return  (cav.get('group') === parts[0] && cav.get('name') === parts[1]);
                    }, this);
                }
            },

            getCampaignByName: function (campaignName) {
                return _.find(this.getCampaigns().models, function(campaign) {
                    return  (campaign.get('name') === campaignName);
                }, this);
            },

            onDestroy: function () {
                UiApi.Logger.debug('secure-payment', 'onDestroy');
                MessageListener.removeListener(this.messageCallback);
                //UiApi.Core.deleteAll(this);
            }
        });
    });

define('components/3rdPartyComp-call-middle/views/view',['ui.api.v1'],
    function (UiApi) {

        var Views = {};
        Views.Layout = UiApi.Framework.Container.extend({
            template: '3rdPartyComp-call-middle',

            events: {
                'click #btn_VoiceSignature': 'onVoiceSignatureClicked',
                'click #btn_CapturePayment': 'onCapturePaymentClicked'
            },

            initialize: function(options) {
                var activeTask = UiApi.ComputedModels.activeTasksModel().getActiveTask(UiApi.ActiveTaskType.Call);
                if (!!activeTask) {
                    this.model = UiApi.SharedPresModelRepo.getModel('call-middle.pres.model', {callId: activeTask.id});
                    this.listenTo(this.model, 'change', this.render);
                    this.model.fetch();
                }
            },

            onVoiceSignatureClicked: function() {
                this.model.toggleVoiceSignature();
            },

            onCapturePaymentClicked: function() {
                this.model.toggleCallRecording();
            }

        });

        return Views;
    });
define('components/3rdPartyComp-call-middle/main',['ui.api.v1', './views/view'],
    function(UiApi, Views) {
        var Component = UiApi.Framework.BaseComponent.extend({
            initialize: function(options) {
                return new Views.Layout(options);
            }
        });
        return Component;
    });

define('3rdparty.bundle',[
    'ui.api.v1',
    'handlebars',
    'workflow/init'

    //presentations models
    ,'presentation.models/call-middle.pres.model'

    //components
    ,'components/3rdPartyComp-call-middle/main'

  ],
  function (UiApi, Handlebars, Init
            ,Constructor0
      ) {

this["JST"] = this["JST"] || {};

this["JST"]["3rdPartyComp-call-middle"] = Handlebars.template({"1":function(container,depth0,helpers,partials,data) {
    var stack1, helper, alias1=depth0 != null ? depth0 : {}, alias2=helpers.helperMissing, alias3="function", alias4=container.escapeExpression;

  return "    <div class=\"third-party-styles\">\r\n        <div class=\"call_action_buttons\">\r\n            <div id=\"3rd-call-tools\" class=\"btn-group\">\r\n                <ul class=\"justify-wrapper columns2\" id=\"3rd-call-controls\">\r\n                    <li>\r\n                        <button id=\"btn_VoiceSignature\" class=\""
    + alias4(((helper = (helper = helpers.btnVoiceSignatureState || (depth0 != null ? depth0.btnVoiceSignatureState : depth0)) != null ? helper : alias2),(typeof helper === alias3 ? helper.call(alias1,{"name":"btnVoiceSignatureState","hash":{},"data":data}) : helper)))
    + "\" style=\"font-size: 9px; text-align: center; \" "
    + ((stack1 = helpers.unless.call(alias1,(depth0 != null ? depth0.btnVoiceSignatureEnabled : depth0),{"name":"unless","hash":{},"fn":container.program(2, data, 0),"inverse":container.noop,"data":data})) != null ? stack1 : "")
    + ">\r\n                            <span style=\"margin: 0 -2px 0 -2px;\">"
    + alias4(((helper = (helper = helpers.VoiceSignatureButtonText || (depth0 != null ? depth0.VoiceSignatureButtonText : depth0)) != null ? helper : alias2),(typeof helper === alias3 ? helper.call(alias1,{"name":"VoiceSignatureButtonText","hash":{},"data":data}) : helper)))
    + "</span>\r\n                        </button>\r\n                    </li>\r\n                    <li>\r\n                        <button id=\"btn_CapturePayment\" class=\""
    + alias4(((helper = (helper = helpers.btnCapturePaymentState || (depth0 != null ? depth0.btnCapturePaymentState : depth0)) != null ? helper : alias2),(typeof helper === alias3 ? helper.call(alias1,{"name":"btnCapturePaymentState","hash":{},"data":data}) : helper)))
    + "\" style=\"font-size: 9px; text-align: center; \" "
    + ((stack1 = helpers.unless.call(alias1,(depth0 != null ? depth0.btnCapturePaymentEnabled : depth0),{"name":"unless","hash":{},"fn":container.program(2, data, 0),"inverse":container.noop,"data":data})) != null ? stack1 : "")
    + ">\r\n                            <span style=\"margin: 0 -2px 0 -2px;\">"
    + alias4(((helper = (helper = helpers.CapturePaymentButtonText || (depth0 != null ? depth0.CapturePaymentButtonText : depth0)) != null ? helper : alias2),(typeof helper === alias3 ? helper.call(alias1,{"name":"CapturePaymentButtonText","hash":{},"data":data}) : helper)))
    + "</span>\r\n                        </button>\r\n                    </li>\r\n                </ul>\r\n            </div>\r\n        </div>\r\n        <div>\r\n            <span class=\"stick-right\" style=\"width: 22px; text-align: right; font-size: 10px; font-weight: bold; margin: -50px 2px 0 0; box-sizing: border-box; border-top: 1px solid #9e9e9e; border-bottom: 1px solid #9e9e9e; border-left: 1px solid #9e9e9e; border-right: 1px solid #9e9e9e; border-radius: 4px; padding: 2px 5px;\" "
    + ((stack1 = helpers.unless.call(alias1,(depth0 != null ? depth0.countdownTimerVisible : depth0),{"name":"unless","hash":{},"fn":container.program(4, data, 0),"inverse":container.noop,"data":data})) != null ? stack1 : "")
    + ">"
    + alias4(((helper = (helper = helpers.seconds || (depth0 != null ? depth0.seconds : depth0)) != null ? helper : alias2),(typeof helper === alias3 ? helper.call(alias1,{"name":"seconds","hash":{},"data":data}) : helper)))
    + "</span>\r\n        </div>\r\n        <div class=\"secure-pay-active call-log-underline\" style=\"margin: 20px 0 0 0\">\r\n            <span style=\"color: darkred; text-align: center; font-weight: bold; width: 100%; margin: -15px 0 0 0; padding: 2px;\">"
    + alias4(((helper = (helper = helpers.securePayState || (depth0 != null ? depth0.securePayState : depth0)) != null ? helper : alias2),(typeof helper === alias3 ? helper.call(alias1,{"name":"securePayState","hash":{},"data":data}) : helper)))
    + "</span>\r\n        </div>\r\n    </div>\r\n";
},"2":function(container,depth0,helpers,partials,data) {
    return "disabled=\"disabled\"";
},"4":function(container,depth0,helpers,partials,data) {
    return "hidden";
},"compiler":[7,">= 4.0.0"],"main":function(container,depth0,helpers,partials,data) {
    var stack1;

  return ((stack1 = helpers["if"].call(depth0 != null ? depth0 : {},(depth0 != null ? depth0.securePayVisible : depth0),{"name":"if","hash":{},"fn":container.program(1, data, 0),"inverse":container.noop,"data":data})) != null ? stack1 : "");
},"useData":true});

    require.config({
      map: {
        '*': {
        }
      }
    });

    UiApi.Logger.info('Registering 3rdparty presentation model with name call-middle.pres.model');
    UiApi.SharedPresModelRepo.registerConstructor('call-middle.pres.model', Constructor0);

    Init.initialize();
    UiApi.vent.on(UiApi.PresModelEvents.WfMainOnModelLoad, function() {
      Init.onModelLoad();
    });
    UiApi.vent.on(UiApi.PresModelEvents.WfMainOnModelUnload, function() {
      Init.onModelUnload();
    });
  });
