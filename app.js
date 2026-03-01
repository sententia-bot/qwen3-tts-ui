const LANGUAGES = ["Auto","English","Chinese","Japanese","Korean","French","German","Spanish","Italian","Portuguese"];

const el = {
  text: document.getElementById('text'),
  speaker: document.getElementById('speaker'),
  language: document.getElementById('language'),
  instruct: document.getElementById('instruct'),
  referenceAudio: document.getElementById('referenceAudio'),
  uploadFile: document.getElementById('uploadFile'),
  uploadBtn: document.getElementById('uploadBtn'),
  refreshRefBtn: document.getElementById('refreshRefBtn'),
  generateBtn: document.getElementById('generateBtn'),
  downloadBtn: document.getElementById('downloadBtn'),
  player: document.getElementById('player'),
  status: document.getElementById('status')
};

let lastBlob = null;

function setStatus(msg) { el.status.textContent = msg; }

async function loadSpeakers() {
  const res = await fetch('/speakers');
  const data = await res.json();
  el.speaker.innerHTML = '';
  for (const s of (data.speakers || [])) {
    const o = document.createElement('option'); o.value = s; o.textContent = s;
    el.speaker.appendChild(o);
  }
}

function loadLanguages() {
  for (const l of LANGUAGES) {
    const o = document.createElement('option'); o.value = l; o.textContent = l;
    el.language.appendChild(o);
  }
  el.language.value = 'Auto';
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
}

async function generate() {
  const text = el.text.value.trim();
  if (!text) return setStatus('Text is required.');

  setStatus('Generating...');
  el.generateBtn.disabled = true;
  try {
    const payload = {
      text,
      language: el.language.value,
      speaker: el.speaker.value || null,
      instruct: el.instruct.value.trim() || null,
      audio_format: 'wav',
      reference_audio: el.referenceAudio.value || null,
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

el.uploadBtn.addEventListener('click', uploadReferenceAudio);
el.refreshRefBtn.addEventListener('click', loadReferenceAudioList);
el.generateBtn.addEventListener('click', generate);
el.downloadBtn.addEventListener('click', downloadAudio);

(async function init() {
  loadLanguages();
  await loadSpeakers();
  await loadReferenceAudioList();
  setStatus('Ready.');
})();
