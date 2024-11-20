// ==UserScript==
// @name         密码自动填充
// @namespace    http://tampermonkey.net/
// @version      0.6.2
// @description  西安石油大学--校园网密码填充插件
// @author       zeMing
// @match        *://*.10.123.0.253/*
// @icon         https://cdn.chinachdu.com/webStatic/wechat-applets/nyt-static/xiao-sun.png
// @license      MIT
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_deleteValue
// @grant        GM_listValues
// ==/UserScript==

/**
 *                  前言
 * 感谢使用，本脚本针对的是 <西安石油大学> --校园网密码填充插件。
 * 作为使用者，你应该对自己的账号和密码妥善保管。
 * 
 * 承诺：本脚本仅用于个人学习、研究使用，不得用于任何商业用途，否则后果自负。
 * 
 */

(function() {
  'use strict';
  /* globals jQuery, $, waitForKeyElements */

  // 解构简易化，勿动
  const { log } = console
  let userInfo = {
    name: '202208130114',
    pass: 'GSQ2719812932..',
  }
  log('已加载自动填充密码脚本！')

  window.onload = () => {
    initView()
  }

  const initView = () => {
    const userNameDom = document.querySelector('input[type="text"][name="DDDDD"]')
    const userPassDom = document.querySelector('input[type="password"][name="upass"]')
    const keepLoginDom = document.querySelector('input[type="checkbox"][name="savePassword"]')
    const submitDom = document.querySelector('input[type="submit"][name="0MKKey"]')

    if (userNameDom || userPassDom) {
      const jsonUser = GM_getValue('userInfo_GM')
      const { name: storageName, pass: storagePass } = jsonUser || {}
      const { name, pass} = userInfo
      userNameDom.value = storageName ?? name
      userPassDom.value = storagePass ?? pass
      keepLoginDom.checked = keepLoginDom.checked || true
      submitDom.click()
    }

    submitDom && submitDom.addEventListener('click', function() {
      userInfo = {
        name: userNameDom.value,
        pass: userPassDom.value,
      }
      GM_setValue('userInfoKey', userInfo)
    })
  }
})()
