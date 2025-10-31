// Web Worker para manter rastreamento ativo em background
// Este worker roda em thread separada e não é pausado

console.log('[WORKER] Iniciado!');

let intervaloAtivo = false;
let celularId = null;
let intervaloTimer = null;
const INTERVALO_MS = 5 * 60 * 1000; // 5 minutos

// Receber mensagens da página principal
self.addEventListener('message', (e) => {
  const { tipo, dados } = e.data;
  
  console.log('[WORKER] Mensagem recebida:', tipo);
  
  switch (tipo) {
    case 'INICIAR':
      iniciarRastreamento(dados.celularId);
      break;
      
    case 'PARAR':
      pararRastreamento();
      break;
      
    case 'PING':
      self.postMessage({ tipo: 'PONG', timestamp: Date.now() });
      break;
      
    case 'STATUS':
      self.postMessage({
        tipo: 'STATUS_RESPOSTA',
        ativo: intervaloAtivo,
        celularId: celularId
      });
      break;
  }
});

function iniciarRastreamento(idCelular) {
  console.log('[WORKER] Iniciando rastreamento para celular:', idCelular);
  
  celularId = idCelular;
  intervaloAtivo = true;
  
  // Primeira verificação imediata
  verificarEEnviar();
  
  // Timer contínuo - Web Workers não são pausados!
  if (intervaloTimer) {
    clearInterval(intervaloTimer);
  }
  
  intervaloTimer = setInterval(() => {
    verificarEEnviar();
  }, 30000); // Verificar a cada 30 segundos
  
  self.postMessage({
    tipo: 'RASTREAMENTO_INICIADO',
    timestamp: Date.now()
  });
}

function pararRastreamento() {
  console.log('[WORKER] Parando rastreamento');
  
  intervaloAtivo = false;
  
  if (intervaloTimer) {
    clearInterval(intervaloTimer);
    intervaloTimer = null;
  }
  
  self.postMessage({
    tipo: 'RASTREAMENTO_PARADO',
    timestamp: Date.now()
  });
}

function verificarEEnviar() {
  if (!intervaloAtivo || !celularId) {
    console.log('[WORKER] Rastreamento inativo ou sem celular');
    return;
  }
  
  console.log('[WORKER] ⏰ Verificando se precisa enviar...');
  
  // Solicitar à página principal que envie a localização
  self.postMessage({
    tipo: 'SOLICITAR_LOCALIZACAO',
    celularId: celularId,
    timestamp: Date.now()
  });
}

// Heartbeat para garantir que worker está vivo
setInterval(() => {
  if (intervaloAtivo) {
    console.log('[WORKER] 💚 Worker ativo e funcionando');
    self.postMessage({
      tipo: 'HEARTBEAT',
      timestamp: Date.now()
    });
  }
}, 60000); // A cada 1 minuto

console.log('[WORKER] Pronto para receber comandos');
