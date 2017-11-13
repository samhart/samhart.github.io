/*
 * Copyright (c) 2016-17 Five9, Inc. The content presented herein may not, under any
 * circumstances, be reproduced in whole or in any part or form without written
 * permission from Five9, Inc.
 */

define('modules/clicktodial-sf',['ui.api.v1', 'underscore', 'api/sf/sf-base.api'],
    function (UiApi, _, BaseSfApi) {
        return {
            initialize: function () {
                UiApi.Logger.info('clicktodial', 'initialize');

                var processMessage = _.bind(function (event) {
                    if (event.data && event.data.type === 'click2dial') {
                        this.onClickToDial({ result: JSON.stringify(event.data.pageInfo) });
                    }
                }, this);

                if (window.attachEvent) {
                    window.attachEvent('onmessage', processMessage);
                } else {
                    window.addEventListener('message', processMessage, false);
                }
            },

            onClickToDial: function (clickToDialResponse) {
                UiApi.Logger.info('clicktodial', 'onClickToDial', clickToDialResponse);
                BaseSfApi.onClickToDial(clickToDialResponse);
            }
        };
    });
define('workflow/init',['ui.api.v1', 'modules/clicktodial-sf'],
    function (UiApi, ClickToDial) {
        return {
            initialize: function () {
                UiApi.Logger.debug('ClickToDial:workflow:initialize');
                ClickToDial.initialize();
            },

            onModelLoad: function () {
                UiApi.Logger.debug('ClickToDial:workflow:onModelLoad');
            },

            onModelUnload: function () {
                UiApi.Logger.debug('ClickToDial:workflow:onModelUnload');
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

