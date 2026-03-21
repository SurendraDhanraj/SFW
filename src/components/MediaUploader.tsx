import { useState, useRef } from 'react'
import { useMutation } from 'convex/react'
import { api } from '../../convex/_generated/api'
import { type Id } from '../../convex/_generated/dataModel'

interface MediaUploaderProps {
  linkedTo: 'address' | 'issue' | 'sub_issue'
  residentId?: Id<'residents'>
  issueId?: Id<'issues'>
  subIssueId?: Id<'subIssues'>
  onUploaded?: () => void
}

export default function MediaUploader({ linkedTo, residentId, issueId, subIssueId, onUploaded }: MediaUploaderProps) {
  const generateUploadUrl = useMutation(api.media.generateUploadUrl)
  const saveMedia = useMutation(api.media.saveMedia)
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [caption, setCaption] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  async function uploadFile(file: File) {
    setUploading(true)
    try {
      const url = await generateUploadUrl()
      const res = await fetch(url, { method: 'POST', body: file, headers: { 'Content-Type': file.type } })
      const { storageId } = await res.json() as { storageId: Id<'_storage'> }
      await saveMedia({
        storageId,
        mimeType: file.type,
        linkedTo,
        residentId,
        issueId,
        subIssueId,
        caption: caption || undefined,
      })
      setCaption('')
      onUploaded?.()
    } catch (err) {
      console.error('Upload failed', err)
    } finally {
      setUploading(false)
    }
  }

  return (
    <div style={{ padding: '0 1rem' }}>
      <div className="field-group" style={{ marginBottom: '0.5rem' }}>
        <label className="field-label" htmlFor="media-caption">Caption (optional)</label>
        <input id="media-caption" type="text" className="field-input" placeholder="Brief description…"
          value={caption} onChange={e => setCaption(e.target.value)} />
      </div>

      <div
        id="media-drop-zone"
        className={`upload-zone${dragOver ? ' drag-over' : ''}`}
        style={{ padding: '1.25rem 1rem', margin: 0 }}
        onClick={() => fileInputRef.current?.click()}
        onDragOver={e => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={e => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) uploadFile(f) }}
      >
        <div className="upload-zone-icon" style={{ marginBottom: '0.25rem' }}>
          <span className="material-symbols-outlined" style={{ fontSize: '32px' }}>
            {uploading ? 'hourglass_empty' : 'add_photo_alternate'}
          </span>
        </div>
        <div className="upload-zone-text" style={{ fontSize: '0.875rem' }}>
          {uploading ? 'Uploading…' : 'Tap or drag to add photo / video'}
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        id="media-file-input"
        accept="image/*,video/*,application/pdf"
        capture="environment"
        style={{ display: 'none' }}
        onChange={e => { const f = e.target.files?.[0]; if (f) uploadFile(f); e.target.value = '' }}
      />
    </div>
  )
}
