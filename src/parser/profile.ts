import { FBProfile, ExportSource, ExportFormat } from '../types'
import { readJson } from '../utils/fs'
import { fixMojibakeDeep } from '../utils/mojibake'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Raw = any

export async function parseProfile(
  root: FileSystemDirectoryHandle,
  format: ExportFormat,
  source: ExportSource
): Promise<FBProfile | null> {
  let raw: Raw = null

  if (format === '2022') {
    const data = await readJson<Raw>(root, 'profile_information', 'profile_information.json')
    raw = data ? (fixMojibakeDeep(data) as Raw)?.profile : null
  } else {
    const data = await readJson<Raw>(
      root, 'personal_information', 'profile_information', 'profile_information.json'
    )
    raw = (data as Raw)?.profile_v2 ?? (data as Raw)?.profile ?? null
  }

  if (!raw) return null

  const education = (raw.education_experiences ?? raw.education ?? []).map((e: Raw) => ({
    name: e.name ?? '',
    type: e.school_type ?? 'School',
    graduated: e.graduated ?? false,
  }))

  const work = (raw.work ?? raw.work_experiences ?? []).map((w: Raw) => ({
    employer: w.employer ?? w.name ?? '',
    title: w.title,
  }))

  return {
    name: raw.name?.full_name ?? '',
    emails: [
      ...(raw.emails?.emails ?? []),
      ...(raw.emails?.previous_emails ?? []),
    ],
    birthday: raw.birthday,
    currentCity: raw.current_city?.name,
    hometown: raw.hometown?.name,
    relationship: raw.relationship ? {
      status: raw.relationship.status,
      partner: raw.relationship.partner,
    } : undefined,
    education: education.length > 0 ? education : undefined,
    work: work.length > 0 ? work : undefined,
    source,
  }
}
