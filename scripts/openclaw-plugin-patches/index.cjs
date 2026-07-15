'use strict';

const { patchDingtalk } = require('./dingtalk.cjs');
const { patchCognee } = require('./cognee.cjs');
const { patchLark } = require('./lark.cjs');
const { patchWeixin } = require('./weixin.cjs');

function applyOpenClawPluginPatches(context) {
  patchCognee(context);
  patchWeixin(context);
  patchLark(context);
  patchDingtalk(context);
}

module.exports = {
  applyOpenClawPluginPatches,
};
