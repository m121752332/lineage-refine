/* 離線字幕名單資料
   以 <script src="credits.js"> 載入，不需 HTTP server（file:// 直接開啟即可）。
   若要修改製作名單，改這個檔案即可。 */
window.CREDITS = {
  title: '天堂：經典版',
  subtitle: '精煉模擬器',
  tagline: '感謝您的遊玩',
  sections: [
    {
      heading: '製作人',
      role_label: true,
      members: [
        { role: '專案負責人', name: 'Tiger' }
      ]
    },
    {
      heading: '程式開發',
      role_label: true,
      members: [
        { role: '前端架構', name: 'Tiger' },
        { role: '遊戲邏輯', name: 'Tiger' },
        { role: 'UI / UX', name: 'Tiger' }
      ]
    },
    {
      heading: '美術設計',
      role_label: true,
      members: [
        { role: '介面美術', name: 'Tiger' },
        { role: '場景設計', name: 'Tiger' }
      ]
    },
    {
      heading: '系統設計',
      role_label: true,
      members: [
        { role: '精煉機制設計', name: 'Tiger' },
        { role: '機率平衡', name: 'Tiger' },
        { role: '商店系統', name: 'Tiger' }
      ]
    },
    {
      heading: '品質測試',
      role_label: true,
      members: [
        { role: '功能測試', name: 'Tiger' },
        { role: '平衡測試', name: 'Tiger' }
      ]
    },
    {
      heading: '特別感謝',
      role_label: false,
      members: [
        { name: 'NC Soft' },
        { name: '天堂經典版開發團隊' },
        { name: '所有提供意見的玩家們' }
      ]
    },
    {
      heading: '技術支援',
      role_label: false,
      members: [
        { name: 'Vue 3 (Evan You & 社群)' },
        { name: 'Google Fonts — Noto Serif TC' },
        { name: 'Claude AI (Anthropic)' }
      ]
    },
    {
      heading: '版權聲明',
      role_label: false,
      members: [
        { name: '本作品為非商業性質之同人模擬作品' },
        { name: '天堂及相關素材版權歸 NC Soft 所有' },
        { name: '© 2026  lineage-refine  Project' }
      ]
    }
  ],
  closing: '點擊任意處返回登入'
};
