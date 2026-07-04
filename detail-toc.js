// 모든 detail 페이지 공용 목차(TOC) 오버레이.
// 페이지의 .detail-section > h2 를 읽어 우측 상단 목차를 자동 생성한다.
// 새 섹션을 추가하면 별도 수정 없이 자동으로 목차에 반영된다.
(function () {
  'use strict';

  function init() {
    var container = document.querySelector('.detail-container');
    if (!container) return;

    var headings = Array.prototype.slice.call(
      container.querySelectorAll('.detail-section > h2')
    );
    if (headings.length === 0) return;

    // 각 섹션에 anchor용 id 부여 (한글 slug 문제를 피하려 인덱스 기반)
    headings.forEach(function (h, i) {
      if (!h.id) h.id = 'sec-' + (i + 1);
    });

    // 열기/닫기 토글 버튼
    var toggle = document.createElement('button');
    toggle.className = 'toc-toggle';
    toggle.type = 'button';
    toggle.setAttribute('aria-label', '목차 열기');
    toggle.innerHTML = '<span class="toc-toggle-icon">☰</span><span class="toc-toggle-text">목차</span>';

    // 목차 패널
    var panel = document.createElement('nav');
    panel.className = 'toc-panel';
    panel.setAttribute('aria-label', '목차');

    var title = document.createElement('div');
    title.className = 'toc-title';
    title.textContent = '목차';
    panel.appendChild(title);

    var list = document.createElement('ul');
    list.className = 'toc-list';

    var links = [];
    headings.forEach(function (h) {
      var li = document.createElement('li');
      var a = document.createElement('a');
      a.href = '#' + h.id;
      a.className = 'toc-link';
      a.textContent = h.textContent;
      a.addEventListener('click', function (e) {
        e.preventDefault();
        h.scrollIntoView({ behavior: 'smooth', block: 'start' });
        // 히스토리에 anchor 반영 (뒤로가기용)
        if (history.replaceState) history.replaceState(null, '', '#' + h.id);
        closePanel();
      });
      li.appendChild(a);
      list.appendChild(li);
      links.push(a);
    });
    panel.appendChild(list);

    function openPanel() {
      panel.classList.add('open');
      toggle.classList.add('active');
      toggle.setAttribute('aria-label', '목차 닫기');
    }
    function closePanel() {
      panel.classList.remove('open');
      toggle.classList.remove('active');
      toggle.setAttribute('aria-label', '목차 열기');
    }
    toggle.addEventListener('click', function () {
      if (panel.classList.contains('open')) closePanel();
      else openPanel();
    });

    // 패널 바깥 터치 시 닫기
    document.addEventListener('click', function (e) {
      if (!panel.classList.contains('open')) return;
      if (panel.contains(e.target) || toggle.contains(e.target)) return;
      closePanel();
    });

    document.body.appendChild(toggle);
    document.body.appendChild(panel);

    // 스크롤 위치에 따라 현재 섹션 하이라이트
    if ('IntersectionObserver' in window) {
      var visible = {};
      var observer = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (entry) {
            visible[entry.target.id] = entry.isIntersecting;
          });
          var current = null;
          for (var i = 0; i < headings.length; i++) {
            if (visible[headings[i].id]) { current = headings[i].id; break; }
          }
          links.forEach(function (a) {
            a.classList.toggle('active', a.getAttribute('href') === '#' + current);
          });
        },
        { rootMargin: '0px 0px -70% 0px', threshold: 0 }
      );
      headings.forEach(function (h) { observer.observe(h); });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
