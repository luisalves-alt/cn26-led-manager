import { google } from 'googleapis'

function getAuth() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_KEY!
  const credentials = JSON.parse(raw)
  return new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/drive'],
  })
}

export function driveEnabled() {
  return !!process.env.GOOGLE_SERVICE_ACCOUNT_KEY
}

export async function createDriveFolder(name: string, parentId?: string): Promise<string> {
  const drive = google.drive({ version: 'v3', auth: getAuth() })
  const res = await drive.files.create({
    supportsAllDrives: true,
    requestBody: {
      name,
      mimeType: 'application/vnd.google-apps.folder',
      ...(parentId ? { parents: [parentId] } : {}),
    },
    fields: 'id',
  })
  return res.data.id!
}

export async function renameDriveFolder(folderId: string, newName: string): Promise<void> {
  const drive = google.drive({ version: 'v3', auth: getAuth() })
  await drive.files.update({
    fileId: folderId,
    supportsAllDrives: true,
    requestBody: { name: newName },
  })
}

export async function deleteDriveFolder(folderId: string): Promise<void> {
  const drive = google.drive({ version: 'v3', auth: getAuth() })
  try {
    await drive.files.delete({ fileId: folderId, supportsAllDrives: true })
  } catch (e: any) {
    if (e?.code !== 404) throw e
  }
}

export async function getDriveFileParent(fileId: string): Promise<string | null> {
  const drive = google.drive({ version: 'v3', auth: getAuth() })
  const res = await drive.files.get({ fileId, fields: 'parents', supportsAllDrives: true })
  return res.data.parents?.[0] ?? null
}

export async function moveDriveFolder(fileId: string, newParentId: string, oldParentId: string): Promise<void> {
  const drive = google.drive({ version: 'v3', auth: getAuth() })
  await drive.files.update({
    fileId,
    supportsAllDrives: true,
    addParents: newParentId,
    removeParents: oldParentId,
    fields: 'id',
  })
}

export async function shareWithAnyone(folderId: string): Promise<void> {
  const drive = google.drive({ version: 'v3', auth: getAuth() })
  await drive.permissions.create({
    fileId: folderId,
    supportsAllDrives: true,
    requestBody: { role: 'writer', type: 'anyone' },
  })
}

export function driveUrl(folderId: string): string {
  return `https://drive.google.com/drive/folders/${folderId}`
}
