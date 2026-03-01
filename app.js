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
  referenceAudio: document.getElementById('referenceAudio'),
  uploadFile: document.getElementById('uploadFile'),
  uploadBtn: document.getElementById('uploadBtn'),
  manageVoicesBtn: document.getElementById('manageVoicesBtn'),
  manageVoicesPanel: document.getElementById('manageVoicesPanel'),
  voiceList: document.getElementById('voiceList'),
  generateBtn: document.getElementById('generateBtn'),
  downloadBtn: document.getElementById('downloadBtn'),
  saveVoiceBtn: document.getElementById('saveVoiceBtn'),
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


function b64ToBlob(b64, mime) {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

function setProgress(pct, tokens, estimated) {
  const safePct = Math.max(0, Math.min(100, Number(pct) || 0));
  el.progressWrap.classList.remove('hidden');
  el.progressBar.style.width = `${safePct}%`;
  el.progressText.textContent = `Generating... ${safePct}% (${tokens} / ${estimated} tokens)`;
}

function resetProgress() {
  el.progressWrap.classList.add('hidden');
  el.progressBar.style.width = '0%';
  el.progressText.textContent = 'Generating... 0% (0 / 1 tokens)';
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
      const res = await fetch(`/reference-audio/${encodeURIComponent(file.filename)}`, { method: 'DELETE' });
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

async function loadReferenceAudioList(preselect = null) {
  const res = await fetch('/reference-audio');
  const data = await res.json();
  const current = preselect || el.referenceAudio.value;
  referenceAudioFiles = (data.files || []).map((f) => (
    typeof f === 'string' ? { filename: f, source: 'upload', description: null } : f
  ));

  renderVoiceDropdown(current);
  renderVoiceManagement();
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
  await loadReferenceAudioList(file.name);
  updateSelectedReference();
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
  setProgress(0, 0, 1);

  try {
    const payload = {
      text,
      language: el.language.value,
      audio_format: 'wav',
      mode: currentMode,
      reference_audio: currentMode === 'clone' ? (el.referenceAudio.value || null) : null,
      voice_description: currentMode === 'design' ? (el.voiceDescription.value.trim() || null) : null,
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

    if (!res.body) {
      resetProgress();
      setStatus('Generation failed: no response stream body.');
      return;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let eventType = null;
    let doneReceived = false;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split('
');
      buffer = lines.pop() || '';

      for (const rawLine of lines) {
        const line = rawLine.trimEnd();
        if (!line) {
          eventType = null;
          continue;
        }
        if (line.startsWith('event: ')) {
          eventType = line.slice(7).trim();
          continue;
        }
        if (!line.startsWith('data: ')) continue;

        let payloadData;
        try {
          payloadData = JSON.parse(line.slice(6));
        } catch (err) {
          setStatus(`Stream parse error: ${err.message || err}`);
          continue;
        }

        if (eventType === 'progress') {
          setProgress(payloadData.pct ?? 0, payloadData.tokens ?? 0, payloadData.estimated_total ?? 1);
        } else if (eventType === 'done') {
          doneReceived = true;
          setProgress(100, payloadData.tokens_generated ?? 0, payloadData.tokens_generated ?? 1);
          const blob = b64ToBlob(payloadData.audio_b64, 'audio/wav');
          lastBlob = blob;
          const url = URL.createObjectURL(blob);
          el.player.src = url;
          el.downloadBtn.disabled = false;
          el.saveVoiceBtn.disabled = false;
          setStatus('Done.');
          resetProgress();
        } else if (eventType === 'error') {
          resetProgress();
          setStatus(`Generation failed: ${payloadData.detail || 'unknown error'}`);
        }
      }
    }

    if (!doneReceived && lastBlob === null) {
      resetProgress();
      setStatus('Generation ended without done event.');
    }
  } finally {
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

    const res = await fetch('/reference-audio/save-design', {
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

el.modeSwitch.addEventListener('click', (e) => {
  const btn = e.target.closest('.mode-btn');
  if (!btn) return;
  setMode(btn.dataset.mode);
});
el.referenceAudio.addEventListener('change', updateSelectedReference);
el.textFileBtn.addEventListener('click', () => el.textFileInput.click());
el.textFileInput.addEventListener('change', (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  loadTextFromFile(file);
  el.textFileInput.value = '';
});
el.uploadBtn.addEventListener('click', uploadReferenceAudio);
el.manageVoicesBtn.addEventListener('click', () => {
  el.manageVoicesPanel.classList.toggle('hidden');
});
el.generateBtn.addEventListener('click', generate);
el.downloadBtn.addEventListener('click', downloadAudio);
el.saveVoiceBtn.addEventListener('click', saveAsVoice);

(async function init() {
  loadLanguages();
  setMode('clone');
  await loadReferenceAudioList();
  setStatus('Ready.');
})();
