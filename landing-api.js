import { supabase } from './supabase-client.js'
import { normalizeSectionPositions } from './landing-content.js'

const LANDING_MEDIA_BUCKET = 'landing-media'
const MAX_IMAGE_BYTES = 10 * 1024 * 1024
const IMAGE_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'webp', 'gif'])

function safeExtension(name = '') {
  const extension = String(name).split('.').pop()?.toLowerCase() || ''
  if (!IMAGE_EXTENSIONS.has(extension)) {
    throw new Error('Elige una imagen JPG, JPEG, PNG, WEBP o GIF.')
  }
  return extension
}

function isBundledOrExternal(path = '') {
  const value = String(path)
  return value.startsWith('assets/') || /^https?:\/\//i.test(value)
}

async function landingByStatus(status, { visibleOnly = false } = {}) {
  const { data: version, error: versionError } = await supabase
    .from('landing_versions')
    .select('*')
    .eq('status', status)
    .single()

  if (versionError) throw versionError

  let query = supabase
    .from('landing_sections')
    .select('id,version_id,type,position,visible,content,created_at,updated_at')
    .eq('version_id', version.id)

  if (visibleOnly) query = query.eq('visible', true)

  const { data: sections, error: sectionsError } = await query.order('position', { ascending: true })
  if (sectionsError) throw sectionsError

  return { version, sections: sections || [] }
}

export async function getPublishedLanding() {
  return landingByStatus('published', { visibleOnly: true })
}

export async function getDraftLanding() {
  return landingByStatus('draft')
}

export async function saveDraft(sections = []) {
  const normalized = normalizeSectionPositions(sections)
  const sectionsPayload = normalized.map(({ type, visible, content }) => ({
    type,
    visible: visible !== false,
    content,
  }))

  const { data, error } = await supabase.rpc('save_landing_draft', {
    sections_payload: sectionsPayload,
  })
  if (error) throw error
  return data
}

export async function publishDraft() {
  const { data, error } = await supabase.rpc('publish_landing')
  if (error) throw error
  return data
}

export function publicLandingImageUrl(path = '') {
  const value = String(path || '')
  if (!value || isBundledOrExternal(value)) return value
  const { data } = supabase.storage.from(LANDING_MEDIA_BUCKET).getPublicUrl(value)
  return data?.publicUrl || ''
}

export async function uploadLandingImage(file) {
  if (!file || typeof file.name !== 'string') throw new Error('Selecciona una imagen para subir.')
  if (Number(file.size || 0) > MAX_IMAGE_BYTES) throw new Error('La imagen no puede superar 10 MB.')

  const extension = safeExtension(file.name)
  const path = `${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}.${extension}`
  const storage = supabase.storage.from('landing-media')
  const { error } = await storage.upload(path, file, {
    cacheControl: '31536000',
    upsert: false,
  })
  if (error) throw error

  return { path, publicUrl: publicLandingImageUrl(path) }
}

export async function removeLandingImage(path) {
  const value = String(path || '')
  if (!value || value.startsWith('assets/') || /^https?:\/\//i.test(value)) {
    return { removed: false, reason: 'managed-elsewhere' }
  }

  const { data: referenced, error: referenceError } = await supabase.rpc('landing_media_is_referenced', {
    media_path: value,
  })
  if (referenceError) throw referenceError
  if (referenced) return { removed: false, reason: 'in-use' }

  const storage = supabase.storage.from('landing-media')
  const { error } = await storage.remove([path])
  if (error) throw error
  return { removed: true }
}
