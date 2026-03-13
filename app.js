const LANGUAGES = ["Auto","English","Chinese","Japanese","Korean","French","German","Spanish","Italian","Portuguese","Arabic","Russian"];


const el = {
  text: document.getElementById('text'),
  language: document.getElementById('language'),
  modeSwitch: document.getElementById('modeSwitch'),
  designSection: document.getElementById('designSection'),
  referenceSection: document.getElementById('referenceSection'),
  selectedRefWrap: document.getElementById('selectedRefWrap'),
  selectedRef: document.getElementById('selectedRef'),
  voiceDescription: document.getElementById('voiceDescription'),
  voicePresetSelect: document.getElementById('voicePresetSelect'),
  loadPresetBtn: document.getElementById('loadPresetBtn'),
  savePresetBtn: document.getElementById('savePresetBtn'),
  presetHint: document.getElementById('presetHint'),
  managePresetsBtn: document.getElementById('managePresetsBtn'),
  managePresetsPanel: document.getElementById('managePresetsPanel'),
  presetList: document.getElementById('presetList'),
  referenceAudio: document.getElementById('referenceAudio'),
  fastToggleRow: document.getElementById('fastToggleRow'),
  fastCloneCheckbox: document.getElementById('fastCloneCheckbox'),
  uploadFile: document.getElementById('uploadFile'),
  uploadBtn: document.getElementById('uploadBtn'),
  manageVoicesBtn: document.getElementById('manageVoicesBtn'),
  manageVoicesPanel: document.getElementById('manageVoicesPanel'),
  voiceList: document.getElementById('voiceList'),
  generateBtn: document.getElementById('generateBtn'),
  downloadBtn: document.getElementById('downloadBtn'),
  saveVoiceBtn: document.getElementById('saveVoiceBtn'),
  hardResetBtn: document.getElementById('hardResetBtn'),
  progressWrap: document.getElementById('progressWrap'),
  progressText: document.getElementById('progressText'),
  progressBar: document.getElementById('progressBar'),
  player: document.getElementById('player'),
  status: document.getElementById('status'),
  textFileBtn: document.getElementById('textFileBtn'),
  textFileInput: document.getElementById('textFileInput')
};

let currentMode = 'clone';
let lastBlob = null;
let referenceAudioFiles = [];
let voicePresets = [];

function getActiveUser() {
  try {
    return new URLSearchParams(window.location.search).get('user') || 'default';
  } catch (err) {
    console.error('[qwen3-tts-ui] Failed to parse user query param, falling back to default', err);
    return 'default';
  }
}

const activeUser = getActiveUser();


function b64ToBlob(b64, mime) {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

function setProgress(text, pct) {
  el.progressWrap.classList.remove('hidden');
  el.progressText.textContent = text;
  if (pct != null) el.progressBar.style.width = `${Math.min(100, pct)}%`;
}

function resetProgress() {
  el.progressWrap.classList.add('hidden');
  el.progressText.textContent = '';
  el.progressBar.style.width = '0%';
}

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
    btn.setAttribute('aria-checked', active ? 'true' : 'false');
  }

  const isClone = mode === 'clone';
  el.referenceSection.classList.toggle('hidden', !isClone);
  el.selectedRefWrap.classList.toggle('hidden', !isClone);
  el.designSection.classList.toggle('hidden', isClone);
  el.fastToggleRow.classList.toggle('hidden', !isClone);
  el.fastCloneCheckbox.disabled = !isClone;

  if (el.savePresetBtn) el.savePresetBtn.classList.toggle('hidden', isClone);
  if (el.saveVoiceBtn) el.saveVoiceBtn.classList.toggle('hidden', isClone);

  if (!isClone) {
    loadVoicePresets();
  }
}

function updateSelectedReference() {
  const selected = el.referenceAudio.value;
  const found = referenceAudioFiles.find((f) => f.filename === selected);
  if (!found) {
    el.selectedRef.textContent = selected || 'None';
    return;
  }
  const icon = found.source === 'design' ? '🎨' : '📁';
  el.selectedRef.textContent = `${icon} ${found.filename}`;
}

function renderVoiceDropdown(current) {
  el.referenceAudio.innerHTML = '<option value="">None</option>';
  const uploaded = referenceAudioFiles.filter((f) => (f.source || 'upload') !== 'design');
  const designed = referenceAudioFiles.filter((f) => f.source === 'design');

  const addGroup = (label, files, icon) => {
    if (!files.length) return;
    const group = document.createElement('optgroup');
    group.label = label;
    for (const file of files) {
      const o = document.createElement('option');
      o.value = file.filename;
      o.textContent = `${icon} ${file.filename}`;
      group.appendChild(o);
    }
    el.referenceAudio.appendChild(group);
  };

  addGroup('Uploaded', uploaded, '📁');
  addGroup('Designed', designed, '🎨');

  if ([...el.referenceAudio.options].some((o) => o.value === current)) {
    el.referenceAudio.value = current;
  }
}

function renderVoiceManagement() {
  if (!referenceAudioFiles.length) {
    el.voiceList.innerHTML = '<div class="voice-row">No saved voices yet.</div>';
    return;
  }

  el.voiceList.innerHTML = '';
  for (const file of referenceAudioFiles) {
    const row = document.createElement('div');
    row.className = 'voice-row';

    const left = document.createElement('div');
    left.className = 'voice-meta';

    const icon = document.createElement('span');
    icon.textContent = file.source === 'design' ? '🎨' : '📁';
    const name = document.createElement('strong');
    name.textContent = file.filename;

    left.appendChild(icon);
    left.appendChild(name);

    if (file.source === 'design' && file.description) {
      const desc = document.createElement('div');
      desc.className = 'voice-description';
      desc.textContent = file.description;
      left.appendChild(desc);
    }

    const del = document.createElement('button');
    del.className = 'danger';
    del.textContent = '🗑️ Delete';
    del.addEventListener('click', async () => {
      if (!confirm(`Delete voice ${file.filename}?`)) return;
      const res = await fetch(`/reference-audio/${encodeURIComponent(file.filename)}?user=${encodeURIComponent(activeUser)}`, { method: 'DELETE' });
      if (!res.ok) {
        setStatus(`Delete failed: ${await res.text()}`);
        return;
      }
      setStatus(`Deleted ${file.filename}`);
      await loadReferenceAudioList();
    });

    row.appendChild(left);
    row.appendChild(del);
    el.voiceList.appendChild(row);
  }
}

function getSelectedPreset() {
  const name = el.voicePresetSelect?.value || '';
  if (!name) return null;
  return voicePresets.find((p) => p.name === name) || null;
}

function updatePresetHint() {
  if (!el.presetHint) return;
  const preset = getSelectedPreset();
  el.presetHint.textContent = preset?.description || '';
}

function loadSelectedPresetIntoDescription() {
  const preset = getSelectedPreset();
  if (!preset) {
    updatePresetHint();
    return;
  }
  el.voiceDescription.value = preset.voice_description || '';
  updatePresetHint();
}

function renderPresetManagement() {
  if (!el.presetList) return;

  if (!voicePresets.length) {
    el.presetList.innerHTML = '<div class="voice-row">No saved presets yet.</div>';
    return;
  }

  el.presetList.innerHTML = '';
  for (const preset of voicePresets) {
    if (!preset?.name) continue;

    const row = document.createElement('div');
    row.className = 'voice-row';

    const left = document.createElement('div');
    left.className = 'voice-meta';

    const icon = document.createElement('span');
    icon.textContent = '🎛️';
    const name = document.createElement('strong');
    name.textContent = preset.name;

    left.appendChild(icon);
    left.appendChild(name);

    const descText = preset.description || preset.voice_description || 'No description';
    const desc = document.createElement('div');
    desc.className = 'voice-description';
    desc.textContent = descText;
    left.appendChild(desc);

    const del = document.createElement('button');
    del.className = 'danger';
    del.textContent = '🗑️ Delete';
    del.addEventListener('click', async () => {
      if (!confirm(`Delete preset ${preset.name}?`)) return;
      try {
        const res = await fetch(`/voice-presets/${encodeURIComponent(preset.name)}?user=${encodeURIComponent(activeUser)}`, { method: 'DELETE' });
        if (!res.ok) {
          setStatus(`Delete preset failed: ${await res.text()}`);
          return;
        }
        setStatus(`Deleted preset "${preset.name}".`);
        await loadVoicePresets();
      } catch (err) {
        setStatus(`Delete preset failed: ${err.message || err}`);
      }
    });

    row.appendChild(left);
    row.appendChild(del);
    el.presetList.appendChild(row);
  }
}

async function saveAsPreset() {
  console.log('[preset] saveAsPreset clicked for user', activeUser);

  const voiceDesc = el.voiceDescription.value.trim();
  if (!voiceDesc) {
    setStatus('Enter a voice description first.');
    return;
  }

  const name = prompt('Preset name:');
  if (name === null) {
    setStatus('Save preset cancelled.');
    return;
  }

  const trimmedName = name.trim();
  if (!trimmedName) {
    setStatus('Preset name is required.');
    return;
  }

  const descriptionInput = prompt('Short description (optional):');
  if (descriptionInput === null) {
    setStatus('Save preset cancelled.');
    return;
  }
  const description = descriptionInput.trim();

  try {
    const res = await fetch(`/voice-presets?user=${encodeURIComponent(activeUser)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: trimmedName,
        voice_description: voiceDesc,
        description: description || null,
      }),
    });
    if (!res.ok) {
      setStatus(`Save preset failed: ${await res.text()}`);
      return;
    }
    setStatus(`Preset "${trimmedName}" saved.`);
    await loadVoicePresets();
    el.voicePresetSelect.value = trimmedName;
    updatePresetHint();
  } catch (err) {
    setStatus(`Save preset failed: ${err.message || err}`);
  }
}

async function loadVoicePresets() {
  if (!el.voicePresetSelect) return;
  try {
    const res = await fetch(`/voice-presets?user=${encodeURIComponent(activeUser)}`);
    if (!res.ok) throw new Error(`voice-presets failed: ${res.status}`);
    const data = await res.json();
    voicePresets = Array.isArray(data.presets) ? data.presets : [];

    const current = el.voicePresetSelect.value;
    el.voicePresetSelect.innerHTML = '';
    const blank = document.createElement('option');
    blank.value = '';
    blank.textContent = '— none —';
    el.voicePresetSelect.appendChild(blank);

    for (const preset of voicePresets) {
      if (!preset?.name) continue;
      const o = document.createElement('option');
      o.value = preset.name;
      o.textContent = preset.name;
      el.voicePresetSelect.appendChild(o);
    }

    if ([...el.voicePresetSelect.options].some((o) => o.value === current)) {
      el.voicePresetSelect.value = current;
    } else {
      el.voicePresetSelect.value = '';
    }
    updatePresetHint();
    renderPresetManagement();
  } catch (err) {
    console.error('[qwen3-tts-ui] loadVoicePresets failed', err);
    voicePresets = [];
    if (el.voicePresetSelect) el.voicePresetSelect.innerHTML = '<option value="">— none —</option>';
    if (el.presetHint) el.presetHint.textContent = '';
    renderPresetManagement();
  }
}

async function loadReferenceAudioList(preselect = null) {
  try {
    const res = await fetch(`/reference-audio?user=${encodeURIComponent(activeUser)}`);
    if (!res.ok) throw new Error(`reference-audio failed: ${res.status}`);
    const data = await res.json();
    const current = preselect || el.referenceAudio.value;
    referenceAudioFiles = (data.files || []).map((f) => (
      typeof f === 'string' ? { filename: f, source: 'upload', description: null } : f
    ));

    renderVoiceDropdown(current);
    renderVoiceManagement();
    updateSelectedReference();
  } catch (err) {
    console.error('[qwen3-tts-ui] loadReferenceAudioList failed', err);
    setStatus(`Failed to load voices: ${err.message || err}`);
  }
}

async function uploadReferenceAudio() {
  try {
    const file = el.uploadFile.files[0];
    if (!file) return setStatus('Select a file first.');
    const fd = new FormData();
    fd.append('file', file);
    const res = await fetch(`/reference-audio/upload?user=${encodeURIComponent(activeUser)}`, { method: 'POST', body: fd });
    if (!res.ok) {
      setStatus(`Upload failed: ${await res.text()}`);
      return;
    }
    setStatus(`Uploaded ${file.name}`);
    el.uploadFile.value = '';
    await loadReferenceAudioList(file.name);
    updateSelectedReference();
  } catch (err) {
    console.error('[qwen3-tts-ui] uploadReferenceAudio failed', err);
    setStatus(`Upload failed: ${err.message || err}`);
  }
}

async function hardReset() {
  if (!confirm('Hard reset will unload the current model from GPU memory. Continue?')) return;

  el.hardResetBtn.disabled = true;
  setStatus('Running hard reset...');

  try {
    const res = await fetch('/reset', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ restart: false }),
    });

    if (!res.ok) {
      setStatus(`Hard reset failed: ${await res.text()}`);
      return;
    }

    lastBlob = null;
    el.player.removeAttribute('src');
    el.player.load();
    el.downloadBtn.disabled = true;
    el.saveVoiceBtn.disabled = true;
    el.generateBtn.disabled = true;
    setStatus('Hard reset complete. Model state cleared. Waiting for GPU to settle...');
    await new Promise(r => setTimeout(r, 3000));
    setStatus('Ready.');
  } catch (err) {
    setStatus(`Hard reset failed: ${err.message || err}`);
  } finally {
    el.hardResetBtn.disabled = false;
    el.generateBtn.disabled = false;
  }
}

async function generate() {
  const text = el.text.value.trim();
  if (!text) return setStatus('Text is required.');

  if (currentMode === 'clone' && !el.referenceAudio.value) {
    return setStatus('Select reference audio in Clone mode.');
  }

  if (currentMode === 'design' && !el.voiceDescription.value.trim()) {
    return setStatus('Voice description is required in Design mode.');
  }

  setStatus('Generating...');
  el.generateBtn.disabled = true;
  el.downloadBtn.disabled = true;
  el.saveVoiceBtn.disabled = true;
  lastBlob = null;
  resetProgress();

  // Elapsed-time counter (shown while waiting for first SSE event)
  let elapsed = 0;
  setProgress('Starting...', 0);
  const timer = setInterval(() => { elapsed += 1; }, 1000);

  try {
    const payload = {
      text,
      language: el.language.value,
      audio_format: 'wav',
      mode: currentMode,
      model_size: currentMode === 'clone' && el.fastCloneCheckbox.checked ? 'fast' : 'quality',
      reference_audio: currentMode === 'clone' ? (el.referenceAudio.value || null) : null,
      voice_description: currentMode === 'design' ? (el.voiceDescription.value.trim() || null) : null,
      user: activeUser,
    };

    const res = await fetch('/api/tts/stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      resetProgress();
      setStatus(`Generation failed: ${await res.text()}`);
      return;
    }

    // Parse SSE stream manually
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let lastEventType = '';

    outer: while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split('\n');
      buffer = lines.pop(); // keep incomplete last line

      for (const line of lines) {
        if (line.startsWith('event: ')) {
          lastEventType = line.slice(7).trim();
        } else if (line.startsWith('data: ')) {
          let data;
          try { data = JSON.parse(line.slice(6)); } catch { continue; }

          if (lastEventType === 'chunk_start') {
            const done = data.chunk - 1;
            const label = data.of > 1
              ? `${done}/${data.of} chunks done — generating...`
              : 'Generating...';
            setProgress(label, data.of > 1 ? (done / data.of) * 100 : 0);

          } else if (lastEventType === 'progress') {
            const done = data.chunk - 1;
            const label = data.of > 1
              ? `${done}/${data.of} chunks done — ${data.chunk_pct}%`
              : `Generating... ${data.chunk_pct}%`;
            setProgress(label, data.of > 1 ? data.overall_pct : data.chunk_pct);

          } else if (lastEventType === 'chunk_done') {
            const pct = (data.chunk / data.of) * 100;
            const label = data.of > 1
              ? `${data.chunk}/${data.of} chunks done ✓`
              : 'Done generating, encoding...';
            setProgress(label, pct);

          } else if (lastEventType === 'done') {
            const blob = b64ToBlob(data.audio_b64, 'audio/wav');
            lastBlob = blob;
            const url = URL.createObjectURL(blob);
            el.player.src = url;
            el.downloadBtn.disabled = false;
            el.saveVoiceBtn.disabled = false;
            setStatus(`Done in ${elapsed}s`);
            resetProgress();
            break outer;

          } else if (lastEventType === 'error') {
            resetProgress();
            setStatus(`Generation failed: ${data.detail || 'unknown error'}`);
            break outer;
          }
        }
      }
    }
  } catch (err) {
    resetProgress();
    setStatus(`Generation failed: ${err.message || err}`);
  } finally {
    clearInterval(timer);
    el.generateBtn.disabled = false;
  }
}

function downloadAudio() {
  if (!lastBlob) return;
  const a = document.createElement('a');
  a.href = URL.createObjectURL(lastBlob);
  a.download = 'qwen3-tts-output.wav';
  a.click();
}

function toBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result || '';
      const base64 = String(result).split(',', 2)[1];
      if (!base64) reject(new Error('Failed to convert audio blob to base64'));
      else resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function makeDefaultDesignName() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `designed_${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}.wav`;
}

async function saveAsVoice() {
  if (!lastBlob) {
    setStatus('Generate audio first.');
    return;
  }

  const suggested = makeDefaultDesignName();
  const input = prompt('Voice file name:', suggested);
  if (input === null) return;

  const filename = (input || '').trim() || suggested;
  const normalized = filename.toLowerCase().endsWith('.wav') ? filename : `${filename}.wav`;

  try {
    const audio_b64 = await toBase64(lastBlob);
    const payload = {
      filename: normalized,
      description: el.voiceDescription.value.trim() || null,
      audio_b64,
    };

    const res = await fetch(`/reference-audio/save-design?user=${encodeURIComponent(activeUser)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      setStatus(`Save failed: ${await res.text()}`);
      return;
    }

    await loadReferenceAudioList(normalized);
    setMode('clone');
    el.referenceAudio.value = normalized;
    updateSelectedReference();
    setStatus(`Saved voice as ${normalized}`);
  } catch (err) {
    setStatus(`Save failed: ${err.message || err}`);
  }
}


function loadTextFromFile(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    el.text.value = String(reader.result || '');
    setStatus(`Loaded ${file.name}`);
  };
  reader.onerror = () => setStatus('Failed to read file.');
  reader.readAsText(file);
}

function bindElementEvents() {
  if (el.modeSwitch) {
    el.modeSwitch.addEventListener('click', (e) => {
      const btn = e.target.closest('.mode-btn');
      if (!btn) return;
      setMode(btn.dataset.mode);
    });
  } else {
    console.error('[qwen3-tts-ui] Missing #modeSwitch');
  }

  if (el.referenceAudio) el.referenceAudio.addEventListener('change', updateSelectedReference);
  else console.error('[qwen3-tts-ui] Missing #referenceAudio');

  if (el.loadPresetBtn) el.loadPresetBtn.addEventListener('click', loadSelectedPresetIntoDescription);
  if (el.savePresetBtn) el.savePresetBtn.addEventListener('click', saveAsPreset);
  if (el.voicePresetSelect) el.voicePresetSelect.addEventListener('change', updatePresetHint);
  if (el.managePresetsBtn && el.managePresetsPanel) {
    el.managePresetsBtn.addEventListener('click', () => {
      el.managePresetsPanel.classList.toggle('hidden');
    });
  }

  if (el.textFileBtn && el.textFileInput) {
    el.textFileBtn.addEventListener('click', () => el.textFileInput.click());
    el.textFileInput.addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      loadTextFromFile(file);
      el.textFileInput.value = '';
    });
  } else {
    console.error('[qwen3-tts-ui] Missing #textFileBtn or #textFileInput');
  }

  if (el.uploadBtn) el.uploadBtn.addEventListener('click', uploadReferenceAudio);
  if (el.manageVoicesBtn && el.manageVoicesPanel) {
    el.manageVoicesBtn.addEventListener('click', () => {
      el.manageVoicesPanel.classList.toggle('hidden');
    });
  }
  if (el.generateBtn) el.generateBtn.addEventListener('click', generate);
  if (el.downloadBtn) el.downloadBtn.addEventListener('click', downloadAudio);
  if (el.saveVoiceBtn) el.saveVoiceBtn.addEventListener('click', saveAsVoice);
  if (el.hardResetBtn) el.hardResetBtn.addEventListener('click', hardReset);
}

async function checkApiStatus() {
  const dot = document.getElementById('apiStatus');
  if (!dot) return;
  try {
    let res;
    if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function') {
      res = await fetch('/healthz', { signal: AbortSignal.timeout(4000) });
    } else {
      // Browser fallback for environments that do not support AbortSignal.timeout
      res = await fetch('/healthz');
    }
    dot.className = 'api-status ' + (res.ok ? 'online' : 'offline');
    dot.title = res.ok ? 'API online' : 'API unreachable';
  } catch (err) {
    console.error('[qwen3-tts-ui] checkApiStatus failed', err);
    dot.className = 'api-status offline';
    dot.title = 'API unreachable';
  }
}

function logMissingElements() {
  const missing = Object.entries(el)
    .filter(([, node]) => !node)
    .map(([key]) => key);
  if (missing.length) {
    console.error('[qwen3-tts-ui] Missing required DOM elements:', missing.join(', '));
  }
}

(async function init() {
  try {
    console.log('[qwen3-tts-ui] init start', { activeUser, search: window.location.search });
    logMissingElements();
    bindElementEvents();

    const activeUserLabel = document.getElementById('activeUserLabel');
    if (activeUserLabel) activeUserLabel.textContent = 'user: ' + activeUser;

    loadLanguages();
    setMode('clone');
    await loadReferenceAudioList();
    await loadVoicePresets();
    setStatus('Ready.');
    await checkApiStatus();
    setInterval(checkApiStatus, 30000);
    console.log('[qwen3-tts-ui] init complete');
  } catch (err) {
    console.error('[qwen3-tts-ui] init failed', err);
    setStatus(`Init failed: ${err.message || err}`);
  }
})();
