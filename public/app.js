'use strict';
const $ = id => document.getElementById(id);
const fileInput = $('file'), dropzone = $('dropzone'), compressBtn = $('compress');
let selectedFile = null, busy = false;
function prettyBytes(n) { if (!Number.isFinite(n)) return '—'; const units = ['B','KB','MB','GB','TB']; let i=0; while(n>=1024&&i<units.length-1){n/=1024;i++;} return `${n.toFixed(i>1?2:1)} ${units[i]}`; }
function showError(message) { $('error').textContent = message; $('error').classList.remove('hidden'); }
function clearError() { $('error').classList.add('hidden'); $('error').textContent = ''; }
function setFile(file) {
  clearError(); $('result').classList.add('hidden');
  if (!file) return;
  const allowed = /\.(mp4|mov|mkv|webm|avi|m4v|mpeg|mpg)$/i;
  if (!file.type.startsWith('video/') && !allowed.test(file.name)) return showError('Choose a supported video file (MP4, MOV, MKV, WEBM, AVI).');
  selectedFile = file; $('file-name').textContent = file.name; $('file-size').textContent = prettyBytes(file.size);
  $('file-card').classList.remove('hidden'); dropzone.classList.add('hidden'); compressBtn.disabled = busy;
}
function resetFile() { selectedFile = null; fileInput.value = ''; $('file-card').classList.add('hidden'); dropzone.classList.remove('hidden'); compressBtn.disabled = true; $('result').classList.add('hidden'); clearError(); }
$('browse').addEventListener('click', e => { e.stopPropagation(); fileInput.click(); });
dropzone.addEventListener('click', () => fileInput.click());
dropzone.addEventListener('keydown', e => { if(e.key==='Enter'||e.key===' '){e.preventDefault();fileInput.click();} });
fileInput.addEventListener('change', () => setFile(fileInput.files[0]));
$('remove').addEventListener('click', resetFile);
for(const type of ['dragenter','dragover']) dropzone.addEventListener(type,e=>{e.preventDefault();dropzone.classList.add('drag');});
for(const type of ['dragleave','drop']) dropzone.addEventListener(type,e=>{e.preventDefault();dropzone.classList.remove('drag');});
dropzone.addEventListener('drop', e => setFile(e.dataTransfer.files[0]));
document.querySelectorAll('input[name="mode"]').forEach(input=>input.addEventListener('change',()=>{document.querySelectorAll('.profile').forEach(p=>p.classList.toggle('selected',p.querySelector('input').checked));}));
function parseDisposition(value, fallback) { const match = /filename="?([^";]+)"?/i.exec(value || ''); return match ? match[1] : fallback; }
compressBtn.addEventListener('click', () => {
  if (!selectedFile || busy) return;
  clearError(); $('result').classList.add('hidden'); busy = true; compressBtn.disabled = true;
  $('progress-wrap').classList.remove('hidden'); $('progress-title').textContent = 'Uploading video…'; $('progress-pct').textContent = '0%'; $('progress').style.width = '0%'; $('progress-note').textContent = 'Upload progress is shown first; FFmpeg compression follows on the server.';
  const mode = document.querySelector('input[name="mode"]:checked').value;
  const xhr = new XMLHttpRequest(); xhr.open('POST','/api/compress'); xhr.responseType = 'blob'; xhr.timeout = 0;
  xhr.setRequestHeader('Content-Type','application/octet-stream'); xhr.setRequestHeader('X-File-Name', encodeURIComponent(selectedFile.name)); xhr.setRequestHeader('X-Compression-Mode',mode);
  xhr.upload.onprogress = e => { if(e.lengthComputable){const pct=Math.round(e.loaded/e.total*100);$('progress').style.width=`${pct}%`;$('progress-pct').textContent=`${pct}%`;if(pct===100){$('progress-title').textContent='Compressing video…';$('progress-note').textContent='Upload complete. FFmpeg is processing the video; large files can take time.';}} };
  xhr.onload = async () => {
    busy = false; compressBtn.disabled = !selectedFile;
    if(xhr.status>=200&&xhr.status<300){
      const blob = xhr.response; const a=document.createElement('a'); const url=URL.createObjectURL(blob); a.href=url; a.download=parseDisposition(xhr.getResponseHeader('Content-Disposition'),`${selectedFile?.name||'video'}-compressed.mp4`); document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(url),60000);
      const original=Number(xhr.getResponseHeader('X-Original-Bytes')); const output=Number(xhr.getResponseHeader('X-Compressed-Bytes')); const pct=Number(xhr.getResponseHeader('X-Compression-Percent'));
      $('progress').style.width='100%'; $('progress-pct').textContent='100%'; $('progress-title').textContent='Compression complete'; $('progress-note').textContent='Your compressed MP4 download has started.';
      $('result').textContent = `Done. ${prettyBytes(original)} → ${prettyBytes(output)} · ${pct>0?`${pct}% smaller`:pct===0?'Same size':`${Math.abs(pct)}% larger`}.`;$('result').classList.remove('hidden');
    } else {
      let message='Compression failed. Check that FFmpeg is installed and the server has enough disk space.';
      try{const text=await xhr.response.text();const data=JSON.parse(text);if(data.error)message=data.error;}catch{}
      showError(message); $('progress-title').textContent='Could not compress video'; $('progress-note').textContent='Check the error above and try again.';
    }
  };
  xhr.onerror=()=>{busy=false;compressBtn.disabled=!selectedFile;showError('Network error. The connection may have dropped during upload or processing.');};
  xhr.onabort=()=>{busy=false;compressBtn.disabled=!selectedFile;showError('Upload was cancelled.');};
  xhr.send(selectedFile);
});