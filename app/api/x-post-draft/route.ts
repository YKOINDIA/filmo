import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient, DB_ID, COLLECTIONS, Query } from '../../lib/appwrite-server'

export async function GET() {
  try {
    const { databases } = createAdminClient()
    const res = await databases.listDocuments(DB_ID, COLLECTIONS.X_POST_DRAFTS, [
      Query.orderDesc('$createdAt'),
      Query.limit(50),
    ])
    return NextResponse.json({ data: res.documents })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  const id = request.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  try {
    const { databases } = createAdminClient()
    await databases.deleteDocument(DB_ID, COLLECTIONS.X_POST_DRAFTS, id)
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
