
define('modules/sync-state', [
    'ui.api.v1',
    'underscore',
    'local.storage',
    'presentation.models/pres.model.events'
],

    function (UiApi, _, Events) {


        var SyncStateAdapter = {
            self: null,
            five9ReasonCodes: null,
            omniReasonCodes: null,
            omniLastState: null,
            onSync: false,
            dontGoback: false,
            isHandling: '',
            sfObject: null,
            UiApi: null,


            initialize: function () {
                UiApi.Logger.info('SyncStateAdapter', 'initialize');
                self = this;
                self.UiApi = UiApi;
            },

            onModelLoad: function () {
                UiApi.Logger.info('SyncStateAdapter', 'onModelLoad');

                console.log("@@@@@@@"+JSON.stringify(UiApi.Context));
                if (UiApi.Context.Agent) {
                    UiApi.Root.Agent(UiApi.Context.AgentId).LoginState().on('change:state', this.onAfterLogin);
                    UiApi.Root.Agent(UiApi.Context.AgentId).Call().on('add change', this.onCallReceived);
                    UiApi.Root.Agent(UiApi.Context.AgentId).Presence().on('change:currentState', this.onStateChange);
                }
            },
            getOmniStatus: function (callback) {
                window.sforce.console.presence.getServicePresenceStatusId(function (result) {
                    if (result.success) {
                        if (self.isHandling != 'CHAT') {
                            var statusObject = _.find(self.omniReasonCodes, function (eachCode) { return eachCode.Id.substring(0, self.omniReasonCodes[2].Id.length - 3) == result.statusId; });
                            self.omniLastState = { name: statusObject.DeveloperName, Id: statusObject.Id };
                            UiApi.Logger.info('getOmniStatus', 'Omni Status id  Retrieved successfully');
                        }
                        if (callback != null) {
                            callback();
                        }
                    }
                });
            },

            onModelUnload: function () {
                UiApi.Logger.info('SyncStateAdapter', 'onModelUnload');
                //UiApi.Root.Agent(UiApi.Context.AgentId).Call().off('add change', this.onCallReceived);
                UiApi.Root.Agent(UiApi.Context.AgentId).LoginState().off('change:state', this.onAfterLogin);
                UiApi.Root.Agent(UiApi.Context.AgentId).Presence().off('change:currentState', this.onStateChange);
                self.five9ReasonCodes = null;
                self.omniReasonCodes = null;
                self.omniLastState = null;
                self.onSync = false;
                self.dontGoback = false;
                self.isHandling = '';
            },

            getMetaData: function () {
                console.log('@@@@@@@ getMetaData')
                $.ajax({
                    // TODO testing only, setup some production url
                    url: 'https://app.five9.com/appsvcs/rs/svc/auth/metadata',
                    type: 'GET',
                    contentType: 'application/json',
                    headers: {
                        Authorization: self.UiApi.Context.authToken
                    },
                    success: function (data) {
                        UiApi.Logger.debug('synStateAdapter', 'getMetaData', data);
                        var promisedReasonCodes = self.getNotReadyReasonCodes();
                        promisedReasonCodes.then(function (reasonCodes) {
                            window.parent.postMessage({ evenName: 'FIVE9COLLETION', baseUrl: 'https://'+data.metadata.dataCenters[0].apiUrls[0].host, farmId: data.context.farmId, agentId: data.userId, authTokenId: data.tokenId, 'five9Collection': reasonCodes }, '*');
                        });
                    },
                    error: function (data) {
                        UiApi.Logger.warn('synStateAdapter', 'getMetaData', data);
                    }
                });
            },


            // onStatusChanged: function (data) {
            //     if (self.isHandling == 'CHAT' && data.statusApiName != null && data.statusApiName != 'f9_chat') {
            //         self.dontGoback = true;
            //     }
            //     if (self.isHandling == 'VOICE' && data.statusApiName != null && data.statusApiName.substring(0, 2).toLowerCase() == 'f9') {
            //         self.omniLastState = null;
            //         self.dontGoback = true;
            //     }
            //     if (self.isHandling == 'CHAT' && data.statusApiName == 'f9_chat') {
            //         self.onSync = true;
            //     }

            //     var notReadyState = self.getFive9AdapterReasonCodeId(data.statusApiName.split('_').join(' '), undefined);
            //     if (notReadyState != null && !self.onSync) {
            //         setTimeout(function () {
            //             self.onSync = true;
            //             self.setAgentState([], notReadyState.id);
            //         }, 1000);
            //     }
            //     else if (self.isHandling == 'VOICE' && self.UiApi.Root.Agent(self.UiApi.Context.AgentId).Presence().attributes.pendingState !== null) {
            //         if (notReadyState != null && self.getFive9AdapterReasonCodeId(undefined, self.UiApi.Root.Agent(self.UiApi.Context.AgentId).Presence().attributes.pendingState.notReadyReasonCodeId).name != data.statusApiName.split('_').join(' ')) {
            //             self.onSync = true;
            //             self.setAgentState([], notReadyState.id);
            //         }
            //     }
            //     else if (self.onSync) {
            //         self.onSync = false;
            //     }

            // },
            onAfterLogin: function (data) {
                console.log('@@@@@@@@@ onAfterLogin');
                self.getMetaData();

            },
            // onWorkClosed: function (data) {
            //     if (self.isHandling == 'CHAT') {
            //         window.sforce.console.presence.getAgentWorks(function (result) {
            //             if (result.success) {
            //                 var works = JSON.parse(result.works);
            //                 if (works.length == 0) {
            //                     self.isHandling = '';
            //                     if (self.omniLastState != null && !self.dontGoback) {
            //                         window.sforce.console.presence.setServicePresenceStatus(self.omniLastState.Id.substring(0, self.omniLastState.Id.length - 3), function (result) {
            //                             if (result.success) {
            //                                 self.omniLastState = null;
            //                                 UiApi.Logger.info('FINISHED STATUS CHANGED ', 'Omni status set successfully');
            //                             }
            //                         });
            //                     }
            //                     if (self.dontGoback)
            //                         self.dontGoback = false;
            //                     if (self.isHandling != '')
            //                         self.isHandling = '';
            //                 }
            //             }
            //         });
            //     }
            //     else {
            //         if (self.omniLastState != null && !self.dontGoback) {
            //             window.sforce.console.presence.setServicePresenceStatus(self.omniLastState.Id.substring(0, self.omniLastState.Id.length - 3), function (result) {
            //                 if (result.success) {
            //                     self.omniLastState = null;
            //                     UiApi.Logger.info('FINISHED STATUS CHANGED ', 'Omni status set successfully');
            //                 }
            //             });
            //         }
            //         if (self.dontGoback)
            //             self.dontGoback = false;
            //         if (self.isHandling != '')
            //             self.isHandling = '';
            //     }
            // },
            // onWorkAccepted: function (data) {
            //     self.getOmniStatus(function () {
            //         var omniStatus = self.getOmniChannelReasonCodeId('f9_chat');
            //         if (omniStatus != null) {
            //             window.sforce.console.presence.setServicePresenceStatus(omniStatus.Id.substring(0, omniStatus.Id.length - 3), function (result) {
            //                 if (result.success) {
            //                     UiApi.Logger.info('FINISHED STATUS CHANGED ', 'Omni status set successfully');
            //                 }
            //             });
            //         }
            //         self.isHandling = 'CHAT';
            //     });

            //     // var notReadyState = self.getFive9AdapterReasonCodeId('On Omni',undefined);
            //     // setTimeout(function () {
            //     //     self.onSync = true;
            //     //     self.setAgentState([], notReadyState.id);
            //     // }, 1000);
            // },

            // getFive9AdapterReasonCodeId: function (_statusName, _id) {
            //     if (self.five9ReasonCodes == null) {
            //         var promisedReasonCodes = this.getNotReadyReasonCodes();
            //         promisedReasonCodes.then(function (reasonCodes) {
            //             self.five9ReasonCodes = reasonCodes;
            //             return (_id != undefined ? _.find(self.five9ReasonCodes, function (item) { return item.id == _id }) : _.find(self.five9ReasonCodes, function (item) { return item.name == _statusName }));
            //         });
            //     }
            //     return (_id != undefined ? _.find(self.five9ReasonCodes, function (item) { return item.id == _id }) : _.find(self.five9ReasonCodes, function (item) { return item.name == _statusName }));
            // },
            // getOmniChannelReasonCodeId: function (_statusName) {
            //     return _.find(self.omniReasonCodes, function (item) { return item.DeveloperName == _statusName });
            // },

            onCallReceived: function (model, eventData) {
                if (eventData != null && eventData.context != null) {
                    console.log('=-=-=-=-' + model.attributes.state);
                    console.log('=-=-=-=-' + eventData.context.eventReason);
                    var getState = UiApi.Root.Agent(UiApi.Context.AgentId).Presence().attributes;
                    if (getState.currentState.readyChannels.length > 0) {
                        if ((model.attributes.state === 'TALKING' && eventData.context.eventReason == 'CONNECTED') || (model.attributes.state === 'TALKING' && eventData.context.eventReason == 'UPDATED')) {
                            window.parent.postMessage({ evenName: 'FIVE9-TALKING', state: getState }, '*');
                            // self.isHandling = 'VOICE';
                            // self.getOmniStatus(function () {
                            //     var omniStatus = self.getOmniChannelReasonCodeId('On_Call');
                            //     if (omniStatus != null) {
                            //         window.sforce.console.presence.setServicePresenceStatus(omniStatus.Id.substring(0, omniStatus.Id.length - 3), function (result) {
                            //             if (result.success) {
                            //                 UiApi.Logger.info('FINISHED STATUS CHANGED ', 'Omni status set successfully');
                            //             }
                            //         });
                            //     }
                            // });
                        }
                        else if ((model.attributes.state === 'FINISHED' && eventData.context.eventReason == 'TRANSFERRED')
                            || (model.attributes.state === 'FINISHED' && eventData.context.eventReason == 'CONFERENCE_LEFT')
                            || (model.attributes.state === 'FINISHED' && eventData.context.eventReason == 'DISPOSITIONED')
                            && getState.pendingState !== null) {
                            window.parent.postMessage({ evenName: 'FIVE9-FINISHED', state: getState }, '*');
                            // self.isHandling = '';
                            // var equivalentFive9ReasonCode = self.getFive9AdapterReasonCodeId('', getState.pendingState.notReadyReasonCodeId)
                            // if (getState.pendingState != null && equivalentFive9ReasonCode != null && equivalentFive9ReasonCode.name != 'On Call') {
                            //     self.dontGoback = true;
                            //     var five9Status = self.getFive9AdapterReasonCodeId('', getState.pendingState.notReadyReasonCodeId);
                            //     if (five9Status != null) {
                            //         var omniStatus = self.getOmniChannelReasonCodeId(five9Status.name.split(' ').join('_'));
                            //         if (omniStatus != null) {
                            //             self.onSync = true;
                            //             window.sforce.console.presence.setServicePresenceStatus(omniStatus.Id.substring(0, omniStatus.Id.length - 3), function (result) {
                            //                 if (result.success) {
                            //                     UiApi.Logger.info('FINISHED STATUS CHANGED ', 'Omni status set successfully');
                            //                 }
                            //                 else {
                            //                     self.onSync = false;
                            //                 }
                            //             });
                            //         }
                            //     }
                            // }
                            // if (self.omniLastState != null && !self.dontGoback) {
                            //     window.sforce.console.presence.setServicePresenceStatus(self.omniLastState.Id.substring(0, self.omniLastState.Id.length - 3), function (result) {
                            //         if (result.success) {
                            //             self.omniLastState = null;
                            //             UiApi.Logger.info('FINISHED STATUS CHANGED ', 'Omni status set successfully');
                            //         }
                            //     });
                            // }
                            // if (self.dontGoback) {
                            //     self.dontGoback = false;
                            // }
                        }
                    }
                }
            },

            onStateChange: function (model) {
                console.log('@@@@@@@@@ onStateChange');
                UiApi.Root.Agent(UiApi.Context.AgentId).fetch().done(_.bind(function () {
                    var data = UiApi.Root.Agent(UiApi.Context.AgentId).Presence().attributes;
                    // if (data.pendingState != null && self.getFive9AdapterReasonCodeId('', data.pendingState.notReadyReasonCodeId).name != 'On Call') {
                    //     self.dontGoback = true;
                    // }
                    console.log('@@@@@@@@@ STATUSCHANGE event '+JSON.stringify(data));
                    window.parent.postMessage({ evenName: 'STATUSCHANGE', 'status': data }, '*');
                    // if (data.currentState != null && data.currentState.notReadyReasonCodeId > 0) {// && !self.onSync
                    //     var five9Status = self.getFive9AdapterReasonCodeId('', data.currentState.notReadyReasonCodeId);
                    //     if (five9Status != null) {
                    //         window.parent.postMessage({ evenName: 'STATUSCHANGE', 'status': five9Status }, '*');
                    //         // var omniStatus = self.getOmniChannelReasonCodeId(five9Status.name.split(' ').join('_'));
                    //         // if (omniStatus != null) {
                    //         //     self.onSync = true;
                    //         //     window.sforce.console.presence.setServicePresenceStatus(omniStatus.Id.substring(0, omniStatus.Id.length - 3), function (result) {
                    //         //         if (result.success) {
                    //         //             UiApi.Logger.info('FINISHED STATUS CHANGED ', 'Omni status set successfully');
                    //         //         }
                    //         //         else {
                    //         //             self.onSync = false;
                    //         //         }
                    //         //     });
                    //         // }
                    //     }
                    // }
                    // else if (self.onSync)
                    //     self.onSync = false;
                }, this));
            },


            /**
             * Retrieve not ready reason codes
             *
             * @returns {*|{then, fail}}
             */
            getNotReadyReasonCodes: function () {
                UiApi.Logger.info('SyncStateAdapter', 'getNotReadyReasonCodes');
                var deferred = $.Deferred();

                try {
                    UiApi.Root.Tenant(UiApi.Context.TenantId).NotReadyReasonCodes().fetch()
                        .done(function (reasonCodes) {
                            deferred.resolve(reasonCodes);
                        });
                } catch (e) {
                    deferred.reject(e.message);
                }

                return deferred.promise();
            },
            /**
             * Retrieve agent state
             *
             * @returns {*|{then, fail}}
             */
            getAgentState: function () {
                UiApi.Logger.info('SyncStateAdapter', 'getAgentState', data);
                var deferred = $.Deferred();

                try {
                    var model = UiApi.Root.Agent(UiApi.Context.AgentId).Presence();

                    var data = {
                        agentId: UiApi.Context.AgentId,
                        userName: UiApi.Root.Agent(UiApi.Context.AgentId).get('userName'),
                        currentState: model.get('currentState'),
                        currentStateTime: model.get('currentStateTime')
                    };

                    deferred.resolve(data);
                } catch (e) {
                    deferred.reject(e.message);
                }

                return deferred.promise();
            },

            /**
             * Set agent state ready / not ready
             *
             * @param readyChannels array [ 'CALL', 'VOICE_MAIL' ]
             * @param notReadyReasonCode Reason code Id
             * @returns {*|{then, fail}}
             */
            setAgentState: function (readyChannels, notReadyReasonCode) {
                UiApi.Logger.info('SyncStateAdapter', 'setAgentState', readyChannels, notReadyReasonCode);
                var deferred = $.Deferred();

                var presence = UiApi.Root.Agent(UiApi.Context.AgentId).Presence();

                if (typeof readyChannels === 'undefined') {
                    return deferred.reject('readyChannels parameter required.').promise();
                }

                if (readyChannels.length > 0) {
                    presence.setReadyChannels(readyChannels);
                } else if (readyChannels.length === 0) {
                    presence.setNotReady(notReadyReasonCode);
                }

                return deferred.promise();
            }
        };

        return SyncStateAdapter;
    });
define('workflow/init',[
    'ui.api.v1',
    'modules/sync-state'
    ],
    function (UiApi, SyncStateAdapter) {
        return {
            initialize: function () {
                UiApi.Logger.debug('AgentStateAdapter:workflow:initialize');
                SyncStateAdapter.initialize();
            },

            onModelLoad: function () {
                UiApi.Logger.debug('AgentStateAdapter:workflow:onModelLoad');
                SyncStateAdapter.onModelLoad();
            },

            onModelUnload: function () {
                UiApi.Logger.debug('AgentStateAdapter:workflow:onModelUnload');
                SyncStateAdapter.onModelUnload();
            }
        };
    });

define('3rdparty.bundle',[
    'ui.api.v1',
    'handlebars',
    'workflow/init'

    //presentations models

    //components

  ],
  function (UiApi, Handlebars, Init
) {



    require.config({
      map: {
        '*': {
        }
      }
    });


    Init.initialize();
    UiApi.vent.on(UiApi.PresModelEvents.WfMainOnModelLoad, function() {
      Init.onModelLoad();
    });
    UiApi.vent.on(UiApi.PresModelEvents.WfMainOnModelUnload, function() {
      Init.onModelUnload();
    });
  });

