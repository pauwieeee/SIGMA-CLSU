export type ScholarshipCategoryName = 'Institutional' | 'Government' | 'Private'
export type ScholarshipStatus = 'Active' | 'Expiring Soon' | 'Inactive' | 'Archived'
export type StudentScholarshipStatus =
  | 'Active'
  | 'For Renewal'
  | 'Documents Incomplete'
  | 'Pending Verification'
  | 'Inactive'
export type Semester = '1st Semester' | '2nd Semester' | 'Summer'
export type DegreeLevel = 'Undergraduate' | 'Graduate'
export type DuplicateFlagStatus = 'Open' | 'Resolved'

export interface College {
  id: string
  name: string
  code: string
  created_at: string
}

export interface Program {
  id: string
  college_id: string
  name: string
  code: string | null
  degree_level: DegreeLevel
  created_at: string
}

export interface Student {
  id: string
  student_number: string
  last_name: string
  first_name: string
  middle_initial: string | null
  program_id: string
  yr_level: string
  address: string | null
  contact_number: string | null
  email: string | null
  gwa: number | null
  participation_org: string | null
  archived_at: string | null
  created_at: string
  updated_at: string
}

export interface ScholarshipCategory {
  id: string
  name: ScholarshipCategoryName
  created_at: string
}

export interface ScholarshipAgency {
  id: string
  category_id: string
  name: string
  created_at: string
}

export interface Scholarship {
  id: string
  category_id: string
  agency_id: string | null
  name: string
  code: string | null
  description: string | null
  status: ScholarshipStatus
  start_date: string | null
  end_date: string | null
  notes: string | null
  level: string | null
  qualifications: string | null
  application_requirements: string | null
  benefits_amount: string | null
  coverage_deadline: string | null
  contact_person: string | null
  contact_email: string | null
  archived_at: string | null
  created_at: string
  updated_at: string
}

export interface StudentScholarship {
  id: string
  student_id: string
  scholarship_id: string
  academic_year: string
  semester: Semester
  status: StudentScholarshipStatus
  start_date: string | null
  end_date: string | null
  archived_at: string | null
  created_at: string
  updated_at: string
}

export interface DuplicateFlag {
  id: string
  student_id: string
  student_scholarship_id_a: string
  student_scholarship_id_b: string
  reason: string
  status: DuplicateFlagStatus
  resolved_by: string | null
  resolved_at: string | null
  created_at: string
}

export interface ActivityLog {
  id: string
  actor_id: string | null
  action: string
  entity_type: string
  entity_id: string | null
  description: string
  created_at: string
}

export interface AppNotification {
  id: string
  type: 'expiring_soon' | 'duplicate_flag' | 'import_complete'
  title: string
  message: string
  is_read: boolean
  related_entity_id: string | null
  created_at: string
}

export interface ImportBatch {
  id: string
  filename: string
  imported_by: string | null
  row_count: number
  error_count: number
  status: 'Processing' | 'Completed' | 'Failed'
  error_log: unknown
  created_at: string
}

export interface DashboardStats {
  total_scholars: number
  active_scholarships: number
  duplicate_flags_open: number
  expiring_soon: number
}

export interface ScholarsPerCategory {
  category_name: ScholarshipCategoryName
  scholar_count: number
}

// Minimal Database type for the supabase-js client generic.
// Not exhaustive — extend with `supabase gen types` once the project is live.
export interface Database {
  public: {
    Tables: {
      colleges: { Row: College; Insert: Partial<College>; Update: Partial<College> }
      programs: { Row: Program; Insert: Partial<Program>; Update: Partial<Program> }
      students: { Row: Student; Insert: Partial<Student>; Update: Partial<Student> }
      scholarship_categories: {
        Row: ScholarshipCategory
        Insert: Partial<ScholarshipCategory>
        Update: Partial<ScholarshipCategory>
      }
      scholarship_agencies: {
        Row: ScholarshipAgency
        Insert: Partial<ScholarshipAgency>
        Update: Partial<ScholarshipAgency>
      }
      scholarships: { Row: Scholarship; Insert: Partial<Scholarship>; Update: Partial<Scholarship> }
      student_scholarships: {
        Row: StudentScholarship
        Insert: Partial<StudentScholarship>
        Update: Partial<StudentScholarship>
      }
      duplicate_flags: { Row: DuplicateFlag; Insert: Partial<DuplicateFlag>; Update: Partial<DuplicateFlag> }
      activity_logs: { Row: ActivityLog; Insert: Partial<ActivityLog>; Update: Partial<ActivityLog> }
      notifications: { Row: AppNotification; Insert: Partial<AppNotification>; Update: Partial<AppNotification> }
      import_batches: { Row: ImportBatch; Insert: Partial<ImportBatch>; Update: Partial<ImportBatch> }
    }
    Views: {
      dashboard_stats: { Row: DashboardStats }
      scholars_per_category: { Row: ScholarsPerCategory }
    }
  }
}
