// ==UserScript==
// @name         豆包批量删除历史对话
// @namespace    https://www.doubao.com/
// @version      0.0.1
// @description  在 https://www.doubao.com/chat/coding 页面上尝试批量删除历史对话（通过页面上的删除按钮和确认框）
// @author       zeMing
// @match        https://www.doubao.com/*
// @grant        none
// @run-at       document-idle
// @require      file://C:\myWorkHome\monkey-unit\豆包删除.js
// ==/UserScript==

(function () {
  'use strict';

  /***** 配置区（需要时可修改） *****/
  const CONFIG = {
    delayBetweenDeletesMs: 1000, // 每次删除后等待时间（毫秒），避免过快触发
    scrollDelayMs: 300,          // 模拟滚动/打开会话后等待页面渲染时间
    maxDeletesPerRun: 500,       // 一次运行最多删除多少条（防止无限循环）
    autoCloseModals: true,       // 是否尝试自动点击确认模态里的 “确定/删除” 按钮
  }

  /***** 辅助函数 *****/
  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  function log(...args) {
    console.log('[日志]', ...args)
  }

  // 尝试在 node 下以多种策略找到“删除”按钮
  function findDeleteButtonWithin(node) {
    if (!node) return null
    // 优先匹配文本类包含“删除”的按钮/链接
    const btnByText = Array.from(node.querySelectorAll('button, a, div'))
      .find(el => {
        const t = (el.innerText || '').trim()
        if (!t) return false
        return /删除|移除|删除会话|删除对话|Delete/i.test(t)
      })
    if (btnByText) return btnByText

    // 按 aria-label、title、data-action 等常见属性寻找
    const btnByAttr = node.querySelector(
      'button[aria-label*="删除"], button[title*="删除"], button[data-action*="delete"], a[aria-label*="删除"], a[title*="删除"], a[data-action*="delete"]'
    )
    if (btnByAttr) return btnByAttr

    // 查找图标按钮（垃圾桶等），尝试识别常见 class 名称
    const iconBtn = Array.from(node.querySelectorAll('button, a, span, div')).find(el => {
      const c = (el.className || '').toLowerCase()
      return c.includes('delete') || c.includes('trash') || c.includes('remove') || c.includes('icon-delete') || c.includes('icon-trash')
    })
    if (iconBtn) return iconBtn

    return null
  }

  // 在页面范围内查找可能代表会话列表项的元素集合
  function findConversationItems() {
    // 常见的位置：左侧或页面中含有对话列表的容器
    // 这个选择器需要依据实际页面调整；下面是通用尝试：
    const candidates = [
      '#conversation-list',            // 自定义 id
      '.conversation-list',            // 自定义 class
      '.chat-list',                    // 常见 class
      '.side-list', '.sidebar .list',  // 侧边栏的 list
      '.history-list', '.history',     // 历史记录
      '.dialogs', '.dialog-list',
      'ul li',                         // fallback: 页面内所有 li（会浪费）
    ]

    for (const sel of candidates) {
      const el = document.querySelector(sel)
      if (el && el.children && el.children.length > 0) {
        log('找到 conversations container by selector:', sel)
        return Array.from(el.children)
      }
    }

    // fallback：在页面中尽量挑选含有“会话”“对话”“聊天”等文本的父容器
    const els = Array.from(document.querySelectorAll('div, section, aside')).filter(e => {
      const text = (e.innerText || '').slice(0, 200)
      return /会话|对话|聊天|历史/.test(text)
    })
    if (els.length) {
      // choose the one with most children
      const best = els.reduce((a, b) => (a.children.length >= b.children.length ? a : b))
      if (best.children.length) {
        log('fallback: 找到 conversations container by content')
        return Array.from(best.children)
      }
    }

    // 最后退到页面上尽量多的 list 项（谨慎）
    const allListItems = Array.from(document.querySelectorAll('li, .item, .list-item')).filter(el => el.innerText && el.innerText.length < 2000)
    if (allListItems.length > 0) {
      log('fallback: 使用大量 list items:', allListItems.length)
      return allListItems
    }

    return []
  }

  // 替换用：尝试触发删除对话流程（适配豆包右侧三点 -> 弹窗 -> 删除）
  async function tryDeleteConversationItem(item) {
    try {
      // 1) 找到右侧“更多（三点）”按钮（更宽松的 selector，兼容不同 class）
      const menuTrigger = item.querySelector(
        '[data-testid="chat_item_dropdown_entry"], .extra-aW1KZB [data-testid^="chat_item_dropdown_entry"], .chat-item-menu-button-outline-dFKys7 [data-testid="chat_item_dropdown_entry"], [aria-haspopup][data-popupid]'
      )
      if (!menuTrigger) {
        log('未找到三点菜单触发按钮，跳过此项。')
        return false
      }

      // 2) 模拟真实点击（多种事件序列提高兼容性）
      menuTrigger.scrollIntoView({ behavior: 'auto', block: 'center' })
      menuTrigger.dispatchEvent(new MouseEvent('pointerover', { bubbles: true }))
      menuTrigger.dispatchEvent(new MouseEvent('pointerenter', { bubbles: true }))
      menuTrigger.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
      menuTrigger.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))
      try { menuTrigger.click() } catch (e) { /* 安全兜底 */ }
      await sleep(250) // 等待弹窗渲染

      // 3) 在所有可能的 popover 容器中查找“删除”项，优先选择距离当前 item 最近且可见的一个
      const itemRect = item.getBoundingClientRect()
      const popoverSelectors = [
        '.semi-portal-inner',
        '.samantha-popover-tTqfwm',
        '.semi-popover-wrapper',
        '.chat-item-menu-dropdown-8DtqBM',
        '.semi-popover'
      ]
      const popovers = Array.from(document.querySelectorAll(popoverSelectors.join(','))).filter(p => p && p.offsetParent !== null)

      let bestCandidate = null
      let bestDist = Infinity

      for (const pop of popovers) {
        // 在 popover 内找 li（菜单项）
        const lis = Array.from(pop.querySelectorAll('li[role="menuitem"], li, .semi-dropdown-item'))
        for (const li of lis) {
          const text = (li.innerText || '').trim()
          const isDeleteText = /删除|移除|Delete|Remove/i.test(text)
          const hasRemoveClass = (li.className || '').includes('remove-btn') || (li.className || '').toLowerCase().includes('remove-btn')
          const hasRemoveIcon = !!li.querySelector('[data-testid="chat_item_menu_remove_icon"]')

          if (!(isDeleteText || hasRemoveClass || hasRemoveIcon)) continue
          if (li.offsetParent === null) continue // 不可见的不要

          const prect = pop.getBoundingClientRect()
          const dx = ((prect.left + prect.right) / 2) - ((itemRect.left + itemRect.right) / 2)
          const dy = ((prect.top + prect.bottom) / 2) - ((itemRect.top + itemRect.bottom) / 2)
          const dist = dx * dx + dy * dy
          if (dist < bestDist) {
            bestDist = dist
            bestCandidate = li
          }
        }
      }

      // 4) 回退策略：直接查找可见的删除图标 span（全局）
      if (!bestCandidate) {
        const icon = Array.from(document.querySelectorAll('span[data-testid="chat_item_menu_remove_icon"]')).find(sp => sp.offsetParent !== null)
        if (icon) bestCandidate = icon.closest('li') || icon.parentElement
      }

      // 5) 最后回退：全局可见并包含“删除”文本的元素
      if (!bestCandidate) {
        bestCandidate = Array.from(document.querySelectorAll('li, button, div, a'))
          .find(el => el.offsetParent !== null && /(^|\s)删除(\s|$)|删除会话|删除对话|Remove|Delete/i.test(el.innerText || '')) || null
      }

      if (!bestCandidate) {
        log('展开菜单后未能找到删除项（可能是 selector 需要更新）')
        return false
      }

      // 6) 点击删除项（确保拿到可点击元素，而不是 span/svg）
      const clickable = bestCandidate.closest('li, button, a, div')
      if (clickable && typeof clickable.click === 'function') {
        log('准备点击删除项:', clickable)
        clickable.scrollIntoView({ behavior: 'auto', block: 'center' })
        clickable.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }))
        clickable.dispatchEvent(new MouseEvent('pointerup', { bubbles: true }))
        console.log('%c [ clickable.click() ]-191', 'font-size:13px background:pink color:#bf2c9f', clickable.click())
        try {
          clickable.click()
        } catch (e) {
          console.error('clickable.click() 执行报错:', e)
        }
      } else {
        console.warn('bestCandidate 找到了，但不可点击:', bestCandidate)
        return false
      }

      await sleep(220)

      // 7) 处理确认模态（自动点击“删除/确定/确认”等）
      if (CONFIG.autoCloseModals) {
        const confirmBtn = Array.from(document.querySelectorAll('button, a, div'))
          .find(el => el.offsetParent !== null && /(^|\s)(删除|确认|确定|OK|Yes|Delete|Confirm)(\s|$)/i.test(el.innerText || el.title || ''))
        if (confirmBtn) {
          log('找到确认按钮:', confirmBtn.innerText)
          confirmBtn.scrollIntoView({ behavior: 'auto', block: 'center' })
          confirmBtn.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }))
          confirmBtn.dispatchEvent(new MouseEvent('pointerup', { bubbles: true }))
          try {
            confirmBtn.click()
          } catch (e) {
            console.error('confirmBtn.click() 执行报错:', e)
          }
          await sleep(CONFIG.delayBetweenDeletesMs)
          return true
        } else {
          log('未找到确认按钮，可能直接删除成功')
          await sleep(CONFIG.delayBetweenDeletesMs)
          return true
        }
      } else {
        await sleep(CONFIG.delayBetweenDeletesMs)
        return true
      }

    } catch (err) {
      console.error('[DoubaoBulkDelete] 删除时出错:', err)
      return false
    }
  }

  /***** 主流程：逐条处理会话列表 *****/
  async function runBulkDelete() {
    log('开始批量删除（最多 %d 条）', CONFIG.maxDeletesPerRun)

    const items = findConversationItems()
    console.log('%c [ items ]-185', 'font-size:13px background:pink color:#bf2c9f', items)
    if (!items || items.length === 0) {
      alert('未能定位到对话列表。请在页面上打开聊天历史（侧边栏/历史）再试，或手动调整脚本中的选择器。')
      return
    }

    let processed = 0
    // 遍历拷贝（因为删除可能会改变 DOM）
    const snapshot = Array.from(items)

    for (const item of snapshot) {
      if (processed >= CONFIG.maxDeletesPerRun) break

      // skip items that look empty or that are not visible
      if (!item || (item.innerText || '').trim().length === 0) continue
      const ok = await tryDeleteConversationItem(item)
      processed++
      log(`已处理 ${processed}/${snapshot.length}（本次成功？ ${ok}）`)

      // 小停顿，避免触发频率限制或造成页面异常
      await sleep(CONFIG.delayBetweenDeletesMs)
    }

    alert(`已尝试删除 ${processed} 项（注意：部分可能因为页面渲染或选择器不匹配而未真正删除）。请检查历史列表确认结果。`)
    log('批量删除流程结束')
  }

  /***** 在页面注入一个控制按钮，方便手动触发 *****/
  function injectControlButton() {
    // 防止重复注入
    if (document.getElementById('doubao-bulk-delete-btn')) return

    const btn = document.createElement('button')
    btn.id = 'doubao-bulk-delete-btn'
    btn.innerText = '批量删除对话'
    Object.assign(btn.style, {
      position: 'fixed',
      right: '18px',
      bottom: '18px',
      zIndex: 999999,
      padding: '10px 14px',
      background: '#e53935',
      color: '#fff',
      border: 'none',
      borderRadius: '6px',
      cursor: 'pointer',
      boxShadow: '0 6px 18px rgba(0,0,0,0.2)',
      fontSize: '13px'
    })
    btn.title = '点击尝试自动删除对话（会模拟点击删除并确认）。'

    btn.addEventListener('click', async (e) => {
      if (!confirm('确认开始自动删除历史对话？此操作不可撤销，请先确保备份或确定要删除。')) return
      btn.disabled = true
      btn.innerText = '删除中...'
      await runBulkDelete()
      btn.disabled = false
      btn.innerText = '批量删除对话'
    })

    document.body.appendChild(btn)
  }

  /***** 自动注入并监听 DOM 变化（若 SPA 延迟加载） *****/
  function start() {
    injectControlButton()

    // 如果页面是 SPA，等待主要容器加载
    const observer = new MutationObserver((mutations, obs) => {
      // 当页面主体加载后注入按钮并断开 observer（避免重复）
      if (document.body && document.readyState === 'complete') {
        injectControlButton()
        // 不断观察可以在导航后再次注入，但这里我们先保留 observer（可按需断开）
      }
    })
    observer.observe(document.documentElement || document, { childList: true, subtree: true })

    // 快捷键：按 Ctrl+Shift+K 开始删除
    window.addEventListener('keydown', (e) => {
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'k') {
        if (!confirm('按快捷键触发：是否确认开始自动删除历史对话？')) return
        runBulkDelete()
      }
    })
  }

  // 启动
  start()

})()
