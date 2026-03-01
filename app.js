const LANGUAGES = ["Auto","English","Chinese","Japanese","Korean","French","German","Spanish","Italian","Portuguese","Arabic","Russian"];

const MODEL_PREFIX = 'Qwen/Qwen3-TTS-12Hz-1.7B-';

const el = {
  text: document.getElementById('text'),
  language: document.getElementById('language'),
  modeSwitch: document.getElementById('modeSwitch'),
  designSection: document.getElementById('designSection'),
  referenceSection: document.getElementById('referenceSection'),
  selectedRefWrap: document.getElementById('selectedRefWrap'),
  selectedRef: document.getElementById('selectedRef'),
  voiceDescription: document.getElementById('voiceDescription'),
  referenceAudio: document.getElementById('referenceAudio'),
  uploadFile: document.getElementById('uploadFile'),
  uploadBtn: document.getElementById('uploadBtn'),
  refreshRefBtn: document.getElementById('refreshRefBtn'),
  generateBtn: document.getElementById('generateBtn'),
  downloadBtn: document.getElementById('downloadBtn'),
  player: document.getElementById('player'),
  status: document.getElementById('status'),
  modelStatusBar: document.getElementById('modelStatusBar')
};

let currentMode = 'clone';
let lastBlob = null;
let isModelLoading = false;

function setStatus(msg) { el.status.textContent = msg; }

function loadLanguages() {
  for (const l of LANGUAGES) {
    const o = document.createElement('option'); o.value = l; o.textContent = l;
    el.language.appendChild(o);
  }
  el.language.value = 'Auto';
}

function setMode(mode) {
  currentMode = mode;
  for (const btn of el.modeSwitch.querySelectorAll('.mode-btn')) {
    const active = btn.dataset.mode === mode;
    btn.classList.toggle('active', active);
    btn.classList.toggle('inactive', !active);
    btn.setAttribute('aria-checked', active ? 'true' : 'false');
  }

  const isClone = mode === 'clone';
  el.referenceSection.classList.toggle('hidden', !isClone);
  el.selectedRefWrap.classList.toggle('hidden', !isClone);
  el.designSection.classList.toggle('hidden', isClone);
}

function updateSelectedReference() {
  const selected = el.referenceAudio.value;
  el.selectedRef.textContent = selected || 'None';
}

function shortModelName(modelId) {
  if (!modelId) return '';
  return modelId.startsWith(MODEL_PREFIX) ? modelId.slice(MODEL_PREFIX.length) : modelId;
}

function renderModelStatus(modelState, modelId) {
  const state = modelState || 'idle';
  const shortName = shortModelName(modelId);

  el.modelStatusBar.classList.remove('loading', 'ready', 'idle', 'pulse');

  if (state === 'loading') {
    el.modelStatusBar.classList.add('loading', 'pulse');
    el.modelStatusBar.innerHTML = `🟡 <strong>Loading model...</strong>${shortName ? ` <span class="model-name">${shortName}</span>` : ''}`;
    isModelLoading = true;
  } else if (state === 'ready') {
    el.modelStatusBar.classList.add('ready');
    el.modelStatusBar.innerHTML = `🟢 <strong>Ready</strong>${shortName ? ` <span class="model-name">${shortName}</span>` : ''}`;
    isModelLoading = false;
  } else {
    el.modelStatusBar.classList.add('idle');
    el.modelStatusBar.innerHTML = '⚪ <strong>Idle</strong>';
    isModelLoading = false;
  }

  el.generateBtn.disabled = isModelLoading;
}

async function pollStatus() {
  try {
    const res = await fetch('/status');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    renderModelStatus(data.model_state, data.model_id);
  } catch (err) {
    renderModelStatus('idle', null);
  }
}

async function loadReferenceAudioList() {
  const res = await fetch('/reference-audio');
  const data = await res.json();
  const current = el.referenceAudio.value;
  el.referenceAudio.innerHTML = '<option value="">None</option>';
  for (const f of (data.files || [])) {
    const o = document.createElement('option'); o.value = f; o.textContent = f;
    el.referenceAudio.appendChild(o);
  }
  if ([...el.referenceAudio.options].some(o => o.value === current)) {
    el.referenceAudio.value = current;
  }
  updateSelectedReference();
}

async function uploadReferenceAudio() {
  const file = el.uploadFile.files[0];
  if (!file) return setStatus('Select a file first.');
  const fd = new FormData();
  fd.append('file', file);
  const res = await fetch('/reference-audio/upload', { method: 'POST', body: fd });
  if (!res.ok) {
    setStatus(`Upload failed: ${await res.text()}`);
    return;
  }
  setStatus(`Uploaded ${file.name}`);
  el.uploadFile.value = '';
  await loadReferenceAudioList();
  el.referenceAudio.value = file.name;
  updateSelectedReference();
}

async function generate() {
  const text = el.text.value.trim();
  if (!text) return setStatus('Text is required.');

  if (isModelLoading) {
    return setStatus('Model is still loading. Please wait.');
  }

  if (currentMode === 'clone' && !el.referenceAudio.value) {
    return setStatus('Select reference audio in Clone mode.');
  }

  if (currentMode === 'design' && !el.voiceDescription.value.trim()) {
    return setStatus('Voice description is required in Design mode.');
  }

  setStatus('Generating...');
  el.generateBtn.disabled = true;
  try {
    const payload = {
      text,
      language: el.language.value,
      audio_format: 'wav',
      mode: currentMode,
      reference_audio: currentMode === 'clone' ? (el.referenceAudio.value || null) : null,
      voice_description: currentMode === 'design' ? (el.voiceDescription.value.trim() || null) : null,
    };

    const res = await fetch('/api/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      setStatus(`Generation failed: ${await res.text()}`);
      return;
    }

    const blob = await res.blob();
    lastBlob = blob;
    const url = URL.createObjectURL(blob);
    el.player.src = url;
    el.downloadBtn.disabled = false;
    setStatus('Done.');
  } finally {
    el.generateBtn.disabled = isModelLoading;
  }
}

function downloadAudio() {
  if (!lastBlob) return;
  const a = document.createElement('a');
  a.href = URL.createObjectURL(lastBlob);
  a.download = 'qwen3-tts-output.wav';
  a.click();
}

el.modeSwitch.addEventListener('click', (e) => {
  const btn = e.target.closest('.mode-btn');
  if (!btn) return;
  setMode(btn.dataset.mode);
});
el.referenceAudio.addEventListener('change', updateSelectedReference);
el.uploadBtn.addEventListener('click', uploadReferenceAudio);
el.refreshRefBtn.addEventListener('click', loadReferenceAudioList);
el.generateBtn.addEventListener('click', generate);
el.downloadBtn.addEventListener('click', downloadAudio);

(async function init() {
  loadLanguages();
  setMode('clone');
  await loadReferenceAudioList();
  await pollStatus();
  setInterval(pollStatus, 3000);
  setStatus('Ready.');
})();
