/* ==========================================================================
   Assinatura na tela (dedo, caneta ou mouse) — devolve uma imagem PNG
   ========================================================================== */
(function (global) {
  'use strict';
  const CKL = global.CKL;
  const { ui, config: cfg } = CKL;
  const { html, icone } = ui;

  /**
   * Monta o quadro de assinatura dentro de "alvo".
   * op: { valor (dataURL ou null), aoMudar(dataURL|null), desabilitado }
   */
  ui.assinatura = function (alvo, op) {
    const L = cfg.ASSINATURA.LARGURA, A = cfg.ASSINATURA.ALTURA;
    alvo.innerHTML = html`
      <div class="assinatura">
        <canvas width="${L}" height="${A}" aria-label="Quadro de assinatura. Assine com o dedo." role="img"></canvas>
        <span class="assinatura-linha" aria-hidden="true"></span>
        <span class="assinatura-dica" aria-hidden="true">Assine aqui</span>
      </div>
      <div class="assinatura-acoes">
        <button type="button" class="btn btn-secundario btn-p" data-assinatura="limpar">${icone('desfazer', 16)}<span>Limpar assinatura</span></button>
      </div>`;
    const canvas = alvo.querySelector('canvas'), ctx = canvas.getContext('2d');
    const dica = alvo.querySelector('.assinatura-dica');
    let desenhando = false, ultimo = null, vazio = true, alterado = false;

    function preparar() {
      ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, L, A);
      ctx.lineWidth = 4.2; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = '#10261c';
    }
    preparar();
    if (op.valor) {
      const img = new Image();
      img.onload = () => { ctx.drawImage(img, 0, 0, L, A); vazio = false; dica.hidden = true; };
      img.src = op.valor;
    }

    function ponto(ev) {
      const r = canvas.getBoundingClientRect();
      return { x: (ev.clientX - r.left) * (L / r.width), y: (ev.clientY - r.top) * (A / r.height) };
    }
    canvas.addEventListener('pointerdown', (ev) => {
      if (op.desabilitado) return;
      ev.preventDefault();
      canvas.setPointerCapture(ev.pointerId);
      desenhando = true; ultimo = ponto(ev);
      ctx.beginPath(); ctx.arc(ultimo.x, ultimo.y, 2, 0, Math.PI * 2); ctx.fillStyle = '#10261c'; ctx.fill();
      vazio = false; alterado = true; dica.hidden = true;
    });
    canvas.addEventListener('pointermove', (ev) => {
      if (!desenhando) return;
      ev.preventDefault();
      const p = ponto(ev);
      ctx.beginPath(); ctx.moveTo(ultimo.x, ultimo.y); ctx.lineTo(p.x, p.y); ctx.stroke();
      ultimo = p;
    });
    const terminar = () => {
      if (!desenhando) return;
      desenhando = false;
      if (alterado) { alterado = false; op.aoMudar(canvas.toDataURL('image/png')); }
    };
    canvas.addEventListener('pointerup', terminar);
    canvas.addEventListener('pointercancel', terminar);
    canvas.addEventListener('pointerleave', terminar);
    alvo.querySelector('[data-assinatura="limpar"]').addEventListener('click', () => {
      if (op.desabilitado) return;
      preparar(); vazio = true; dica.hidden = false; op.aoMudar(null);
    });
    return { vazia: () => vazio };
  };
})(window);
