type ImportSizeLimit = {
  planId: string | null
  limitMb: number | null
  limitBytes: number | null
  error?: string | null
}

type StorageSizeInfo = {
  sizeBytes: number | null
  error?: string | null
  status?: number | null
}

const toNumberOrNull = (value: unknown) => {
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value))) {
    return Number(value)
  }
  return null
}

const encodeStoragePath = (path: string) =>
  path
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/")

export const resolveImportSizeLimit = async (supabaseAdmin: any, ownerId: string): Promise<ImportSizeLimit> => {
  const { data: ownerRow, error: ownerErr } = await supabaseAdmin
    .from("app_users")
    .select("plan_id")
    .eq("id", ownerId)
    .maybeSingle()

  if (ownerErr) {
    return { planId: null, limitMb: null, limitBytes: null, error: ownerErr.message }
  }

  const planId = ownerRow?.plan_id ?? null
  if (!planId) {
    return { planId: null, limitMb: null, limitBytes: null, error: null }
  }

  const { data: planRow, error: planErr } = await supabaseAdmin
    .from("planos_users")
    .select("limit_import_mb")
    .eq("id", planId)
    .maybeSingle()

  if (planErr) {
    return { planId, limitMb: null, limitBytes: null, error: planErr.message }
  }

  const limitMb = toNumberOrNull(planRow?.limit_import_mb)
  const limitBytes = limitMb && limitMb > 0 ? Math.round(limitMb * 1024 * 1024) : null

  return { planId, limitMb, limitBytes, error: null }
}

export const resolveStorageObjectSize = async (
  supabaseUrl: string,
  serviceRoleKey: string,
  bucket: string,
  path: string,
): Promise<StorageSizeInfo> => {
  const encodedPath = encodeStoragePath(path)
  const infoUrl = `${supabaseUrl.replace(/\/+$/, "")}/storage/v1/object/info/${bucket}/${encodedPath}`

  const response = await fetch(infoUrl, {
    method: "GET",
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
    },
  })

  if (!response.ok) {
    return { sizeBytes: null, status: response.status, error: await response.text() }
  }

  const payload = await response.json()
  const size = toNumberOrNull(payload?.size ?? payload?.metadata?.size)
  if (!size) {
    return { sizeBytes: null, status: response.status, error: "size_not_found" }
  }

  return { sizeBytes: size, status: response.status }
}
