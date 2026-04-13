/**
 * Supabase-compatible shim backed by Appwrite.
 * This allows existing component code (supabase.from().select().eq() etc.) to work
 * with Appwrite as the backend. The interface mimics supabase-js fluent query builder.
 */
import { databases, DB_ID, COLLECTIONS, Query, ID, account, storage, STORAGE_BUCKETS } from './appwrite'

type CollectionMap = typeof COLLECTIONS
type CollectionKey = CollectionMap[keyof CollectionMap]

function getCollectionId(table: string): string {
  const map: Record<string, string> = {}
  for (const [, v] of Object.entries(COLLECTIONS)) {
    map[v] = v
  }
  return map[table] || table
}

class QueryBuilder {
  private collectionId: string
  private filters: string[] = []
  private sortField: string | null = null
  private sortAsc = true
  private limitCount = 25
  private offsetCount = 0
  private selectFields: string | null = null
  private countOnly = false
  private headOnly = false
  private singleResult = false

  constructor(table: string) {
    this.collectionId = getCollectionId(table)
  }

  select(fields?: string, opts?: { count?: string; head?: boolean }) {
    this.selectFields = fields || '*'
    if (opts?.count === 'exact') this.countOnly = true
    if (opts?.head) this.headOnly = true
    return this
  }

  eq(field: string, value: unknown) {
    if (field === 'id' || field === '$id') {
      this.filters.push(Query.equal('$id', String(value)))
    } else {
      this.filters.push(Query.equal(field, value as string | number | boolean))
    }
    return this
  }

  neq(field: string, value: unknown) {
    this.filters.push(Query.notEqual(field, value as string | number | boolean))
    return this
  }

  in(field: string, values: unknown[]) {
    if (values.length > 0) {
      this.filters.push(Query.equal(field, values as string[]))
    }
    return this
  }

  not(field: string, op: string, value: unknown) {
    if (op === 'is' && value === null) {
      this.filters.push(Query.isNotNull(field))
    }
    return this
  }

  gte(field: string, value: unknown) {
    this.filters.push(Query.greaterThanEqual(field, value as string | number))
    return this
  }

  lte(field: string, value: unknown) {
    this.filters.push(Query.lessThanEqual(field, value as string | number))
    return this
  }

  gt(field: string, value: unknown) {
    this.filters.push(Query.greaterThan(field, value as string | number))
    return this
  }

  lt(field: string, value: unknown) {
    this.filters.push(Query.lessThan(field, value as string | number))
    return this
  }

  order(field: string, opts?: { ascending?: boolean }) {
    this.sortField = field === 'created_at' ? '$createdAt' : field
    this.sortAsc = opts?.ascending ?? true
    return this
  }

  limit(n: number) {
    this.limitCount = n
    return this
  }

  range(from: number, to: number) {
    this.offsetCount = from
    this.limitCount = to - from + 1
    return this
  }

  single() {
    this.singleResult = true
    this.limitCount = 1
    return this
  }

  maybeSingle() {
    this.singleResult = true
    this.limitCount = 1
    return this
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async then(resolve: (value: { data: any; error: any; count?: number }) => void) {
    try {
      const queries = [...this.filters]
      if (this.sortField) {
        queries.push(this.sortAsc ? Query.orderAsc(this.sortField) : Query.orderDesc(this.sortField))
      }
      queries.push(Query.limit(this.limitCount))
      if (this.offsetCount > 0) queries.push(Query.offset(this.offsetCount))

      const result = await databases.listDocuments(DB_ID, this.collectionId, queries)

      if (this.countOnly || this.headOnly) {
        resolve({ data: null, error: null, count: result.total })
        return
      }

      const docs = result.documents.map(normalizeDoc)

      if (this.singleResult) {
        resolve({ data: docs[0] || null, error: docs.length === 0 ? { message: 'Not found' } : null })
        return
      }

      resolve({ data: docs, error: null, count: result.total })
    } catch (e) {
      resolve({ data: this.singleResult ? null : [], error: e, count: 0 })
    }
  }
}

function normalizeDoc(doc: Record<string, unknown>): Record<string, unknown> {
  return {
    ...doc,
    id: doc.$id,
    created_at: doc.$createdAt,
    updated_at: doc.$updatedAt,
  }
}

class TableRef {
  private table: string

  constructor(table: string) {
    this.table = table
  }

  select(fields?: string, opts?: { count?: string; head?: boolean }) {
    const qb = new QueryBuilder(this.table)
    return qb.select(fields, opts)
  }

  async insert(data: Record<string, unknown> | Record<string, unknown>[]) {
    const items = Array.isArray(data) ? data : [data]
    const results: Record<string, unknown>[] = []
    for (const item of items) {
      const docId = (item.id as string) || ID.unique()
      const cleanItem = { ...item }
      delete cleanItem.id
      const doc = await databases.createDocument(DB_ID, getCollectionId(this.table), docId, cleanItem)
      results.push(normalizeDoc(doc as unknown as Record<string, unknown>))
    }
    return {
      data: results.length === 1 ? results[0] : results,
      error: null,
      select: (fields: string) => {
        return {
          single: () => Promise.resolve({ data: results[0] || null, error: null }),
        }
      },
    }
  }

  async upsert(data: Record<string, unknown> | Record<string, unknown>[], _opts?: { onConflict?: string }) {
    const items = Array.isArray(data) ? data : [data]
    const results: Record<string, unknown>[] = []
    const collId = getCollectionId(this.table)
    for (const item of items) {
      const cleanItem = { ...item }
      const docId = (cleanItem.id as string) || undefined
      delete cleanItem.id
      try {
        // Try to find existing document by conflict key or id
        if (docId) {
          try {
            await databases.getDocument(DB_ID, collId, docId)
            const doc = await databases.updateDocument(DB_ID, collId, docId, cleanItem)
            results.push(normalizeDoc(doc as unknown as Record<string, unknown>))
            continue
          } catch { /* not found, will create */ }
        }
        const doc = await databases.createDocument(DB_ID, collId, docId || ID.unique(), cleanItem)
        results.push(normalizeDoc(doc as unknown as Record<string, unknown>))
      } catch (e) {
        return { data: null, error: e }
      }
    }
    return { data: results.length === 1 ? results[0] : results, error: null }
  }

  update(data: Record<string, unknown>) {
    return new UpdateBuilder(this.table, data)
  }

  delete() {
    return new DeleteBuilder(this.table)
  }
}

class UpdateBuilder {
  private table: string
  private data: Record<string, unknown>
  private filters: Array<[string, unknown]> = []

  constructor(table: string, data: Record<string, unknown>) {
    this.table = table
    this.data = data
  }

  eq(field: string, value: unknown) {
    this.filters.push([field, value])
    return this
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async then(resolve: (value: { data: any; error: any }) => void, reject?: (e: unknown) => void) {
    try {
      const collId = getCollectionId(this.table)
      // Remove null/undefined values from update data to avoid Appwrite errors
      const cleanData: Record<string, unknown> = {}
      for (const [k, v] of Object.entries(this.data)) {
        if (v !== null && v !== undefined) cleanData[k] = v
      }
      // Find matching docs
      const queries = this.filters.map(([f, v]) =>
        f === 'id' ? Query.equal('$id', String(v)) : Query.equal(f as string, v as string | number | boolean)
      )
      queries.push(Query.limit(100))
      const result = await databases.listDocuments(DB_ID, collId, queries)
      const updated: Record<string, unknown>[] = []
      for (const doc of result.documents) {
        const updatedDoc = await databases.updateDocument(DB_ID, collId, doc.$id, cleanData)
        updated.push(normalizeDoc(updatedDoc as unknown as Record<string, unknown>))
      }
      resolve({ data: updated.length === 1 ? updated[0] : updated, error: null })
    } catch (e) {
      if (reject) { reject(e) } else { resolve({ data: null, error: e }) }
    }
  }
}

class DeleteBuilder {
  private table: string
  private filters: Array<[string, unknown]> = []

  constructor(table: string) {
    this.table = table
  }

  eq(field: string, value: unknown) {
    this.filters.push([field, value])
    return this
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async then(resolve: (value: { data: any; error: any }) => void) {
    try {
      const collId = getCollectionId(this.table)
      const queries = this.filters.map(([f, v]) =>
        f === 'id' ? Query.equal('$id', String(v)) : Query.equal(f as string, v as string | number | boolean)
      )
      queries.push(Query.limit(100))
      const result = await databases.listDocuments(DB_ID, collId, queries)
      for (const doc of result.documents) {
        await databases.deleteDocument(DB_ID, collId, doc.$id)
      }
      resolve({ data: null, error: null })
    } catch (e) {
      resolve({ data: null, error: e })
    }
  }
}

class AuthShim {
  async getSession() {
    try {
      const acc = await account.get()
      return { data: { session: { user: { id: acc.$id, email: acc.email } } }, error: null }
    } catch {
      return { data: { session: null }, error: null }
    }
  }

  onAuthStateChange(callback: (event: string, session: unknown) => void) {
    // Appwrite doesn't have real-time auth state changes in the same way.
    // We just call once on init.
    this.getSession().then(({ data }) => {
      callback('INITIAL', data.session)
    })
    return { data: { subscription: { unsubscribe: () => {} } } }
  }

  async signUp({ email, password }: { email: string; password: string }) {
    const acc = await account.create(ID.unique(), email, password)
    await account.createEmailPasswordSession(email, password)
    return { data: { user: { id: acc.$id } }, error: null }
  }

  async signInWithPassword({ email, password }: { email: string; password: string }) {
    await account.createEmailPasswordSession(email, password)
    const acc = await account.get()
    return { data: { user: { id: acc.$id } }, error: null }
  }

  async signOut() {
    try {
      await account.deleteSession('current')
    } catch { /* ignore */ }
  }
}

class RpcShim {
  async rpc(name: string, params: Record<string, unknown>) {
    if (name === 'increment_points') {
      const uid = params.uid as string
      const pts = params.pts as number
      const doc = await databases.getDocument(DB_ID, COLLECTIONS.USERS, uid)
      await databases.updateDocument(DB_ID, COLLECTIONS.USERS, uid, {
        points: (doc.points || 0) + pts,
      })
    }
    return { data: null, error: null }
  }
}

class StorageBucketRef {
  private bucketId: string

  constructor(bucket: string) {
    // Map bucket name to Appwrite bucket ID
    const bucketMap: Record<string, string> = {
      avatars: STORAGE_BUCKETS.AVATARS,
      images: STORAGE_BUCKETS.IMAGES,
    }
    this.bucketId = bucketMap[bucket] || bucket
  }

  async upload(path: string, file: File, _opts?: { upsert?: boolean }) {
    try {
      const fileId = ID.unique()
      await storage.createFile(this.bucketId, fileId, file)
      return { data: { path, id: fileId }, error: null }
    } catch (e) {
      return { data: null, error: e }
    }
  }

  getPublicUrl(path: string) {
    // Construct Appwrite file URL — use the path as file ID fallback
    const endpoint = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT || 'https://cloud.appwrite.io/v1'
    const projectId = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID || ''
    const url = `${endpoint}/storage/buckets/${this.bucketId}/files/${path}/view?project=${projectId}`
    return { data: { publicUrl: url } }
  }
}

class StorageShim {
  from(bucket: string) {
    return new StorageBucketRef(bucket)
  }
}

// Main export: supabase-compatible object
export const supabase = {
  from: (table: string) => new TableRef(table),
  auth: new AuthShim(),
  storage: new StorageShim(),
  rpc: async (name: string, params: Record<string, unknown>) => {
    const rpc = new RpcShim()
    return rpc.rpc(name, params)
  },
}
