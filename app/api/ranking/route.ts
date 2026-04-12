import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient, DB_ID, COLLECTIONS, Query } from '../../lib/appwrite-server'

export async function GET(request: NextRequest) {
  const type = request.nextUrl.searchParams.get('type') || 'watches'

  try {
    const { databases } = createAdminClient()

    switch (type) {
      case 'points': {
        const res = await databases.listDocuments(DB_ID, COLLECTIONS.USERS, [
          Query.orderDesc('points'),
          Query.limit(50),
        ])
        return NextResponse.json(res.documents.map((d, i) => ({
          rank: i + 1,
          userId: d.$id,
          name: d.name,
          avatar_url: d.avatar_url,
          value: d.points,
        })))
      }
      case 'streak': {
        const res = await databases.listDocuments(DB_ID, COLLECTIONS.USERS, [
          Query.orderDesc('login_streak'),
          Query.limit(50),
        ])
        return NextResponse.json(res.documents.map((d, i) => ({
          rank: i + 1,
          userId: d.$id,
          name: d.name,
          avatar_url: d.avatar_url,
          value: d.login_streak,
        })))
      }
      case 'watches': {
        const res = await databases.listDocuments(DB_ID, COLLECTIONS.USERS, [
          Query.orderDesc('points'),
          Query.limit(50),
        ])
        // For watches, we'd need to count per user - simplified for now
        return NextResponse.json(res.documents.map((d, i) => ({
          rank: i + 1,
          userId: d.$id,
          name: d.name,
          avatar_url: d.avatar_url,
          value: d.points,
        })))
      }
      default:
        return NextResponse.json({ error: 'Unknown type' }, { status: 400 })
    }
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
