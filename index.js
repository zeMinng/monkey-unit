// ==UserScript==
// @name         密码自动填充
// @namespace    http://tampermonkey.net/
// @version      0.5.1
// @description  懒人专用的密码填充插件
// @author       zeMing
// @match        *://*.project.chinachdu.com/*
// @match        *://*.project.chinachdu.com/user-login*
// @icon         https://cdn.chinachdu.com/webStatic/wechat-applets/nyt-static/xiao-sun.png
// @license      MIT
// @grant        none
// ==/UserScript==

/*
   project.chinachdu.com所有的页面
   //@match        *://*.project.chinachdu.com/*
   jQuery CDN
   //@require https://cdn.staticfile.org/jquery/3.6.4/jquery.min.js
*/

/*
  2023-04-19
  1.[新增]: 默认选中-保持登陆

  2023-04-14
  1.[修复]: 只在登陆页面加载脚本

  2023-04-13
  1.[新增]: 密码填充简易版
*/

(function() {
  'use strict';
  // Your code here...
  /* globals jQuery, $, waitForKeyElements */

  // 解构简易化，勿动
  const { log } = console

  // 在这里配置你的账户信息
  let userInfo = {
      //name: 'duzeming', // 用户名，请更换 place
      //pass: 'By123456', // 密码，请更换 place
      name: '', // 用户名，请更换 place
      pass: '', // 密码，请更换 place
  }
  log('已加载自动填充密码脚本！')
  log(userInfo)
  let userNameDom = document.querySelector('input[type="text"][name="account"]')
  let userPassDom = document.querySelector('input[type="password"][name="password"]')
  let keepLoginDom = document.querySelector('input[type="checkbox"][name="keepLogin[]"]') || document.getElementById("keepLoginon")
  let submitDom = document.getElementById("submit")

  submitDom && submitDom.addEventListener('click', function() {
      userInfo = {
          name: userNameDom.value,
          pass: userPassDom.value,
      }
      localStorage.setItem("userInfoKey", JSON.stringify(userInfo));
  })

  if (userNameDom || userPassDom) {
      log('登录页面')
      const jsonUser = localStorage.getItem('userInfoKey')
      if (!jsonUser) return
      let { name: storageName, pass: storagePass } = jsonUser && JSON.parse(jsonUser)
      let { name, pass} = userInfo
      userNameDom.value = name || storageName
      userPassDom.value = pass || storagePass
      keepLoginDom.checked = keepLoginDom.checked || true
      if (name || pass) return
      submitDom.click()
  }
})();