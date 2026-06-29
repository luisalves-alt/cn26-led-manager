import { NextResponse } from 'next/server'
import { google } from 'googleapis'

export async function GET() {
  try {
    const raw = process.env.GOOGLE_SERVICE_ACCOUNT_KEY!
    const credentials = JSON.parse(raw)
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/drive'],
    })
    const drive = google.drive({ version: 'v3', auth })

    const folderId = process.env.DRIVE_LED_ROOT_FOLDER_ID!

    // List files to test access
    await drive.files.list({
      q: `'${folderId}' in parents`,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    })

    return NextResponse.json({ ok: true, message: 'Service account has access to the folder.' })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
