define('modules/crm.api',['ui.api.v1'],
    function (UiApi) {
        var CRMApi = {
            initialize: function () {
                /**
                 * Initialize CRM engine
                 */
                 alert('hi');
                var configObject = {
                    providerName: 'CRM API',
                    myCallsTodayEnabled: true,
                    connectorExecutorType: UiApi.ConnectorExecutorType.EMBEDDED,
                    floatingModeType: UiApi.FloatingModeType.DISABLED,
                    //autoSsoLogin: false,
                    guideLink: 'www.five9.com'
                };
                UiApi.config(configObject);

                /**
                 * Initialize CRM method handlers
                 */
                CRMApi.customApi = UiApi.Crm.registerApi(
                    {
                        /**
                         * Standard methods
                         */
                        bringAppToFront: 'iframe',
                        search: 'iframe',
                        saveCallLog: 'iframe',
                        screenPop: 'iframe',
                        getTodayCallsCount: 'iframe',
                        openMyCallsToday: 'iframe',
                        enableClickToDial: 'iframe',
                        disableClickToDial: 'iframe',

                        /**
                         *  Custom methods
                         */
                        customMethod1: {
                            methodImpl: 'iframe',
                            executorType: UiApi.Crm.ExecutorType.REMOTE
                        }
                    });

                /**
                 * Initialize CRM event handlers
                 */
                var events = {};
                /**
                 *  Standard events
                 */
                events[UiApi.Crm.Events.CRM_OBJECT_VISITED] = {
                    source: 'iframe:objectVisited'
                };
                events[UiApi.Crm.Events.CRM_CLICK_2_DIAL] = {
                    source: 'iframe:click2dial'
                };
                events[UiApi.Crm.Events.CRM_SUGGESTED_NUMBERS] = {
                    source: 'iframe:suggestedNumbers'
                };
                /**
                 *  Custom events
                 */
                events['crm:api:customEvent1'] = {
                    source: 'iframe:customEvent1'
                };
                UiApi.Crm.registerEvents(events);
            }
        };

        return CRMApi;
    });

define('workflow/init',['ui.api.v1', 'modules/crm.api'],
    function (UiApi, CrmApi) {
        return {
            initialize: function () {
                //Place your library initialization code here
                UiApi.Logger.debug('CrmApi:workflow:initialize');

                // Initialize the CRM Shim
                CrmApi.initialize();
            },

            onModelLoad: function () {

                //Place your server model subscription code here
                UiApi.Logger.debug('CrmApi:workflow:onModelLoad');
            },

            onModelUnload: function () {
                //Place your cleanup code here
                UiApi.Logger.debug('CrmApi:workflow:onModelUnload');
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

