export type DesignerType = 'image' | 'video'
export type DeliveryStatus = 'pending' | 'delivered' | 'revision' | 'approved'

export interface Designer {
  id: string
  event_id: string
  name: string
}

export interface SetupDesigner {
  name: string
}

export interface SetupTask {
  localId: string
  dbId?: string
  name: string
  deadline?: string
}

export interface SetupDesignerSlot {
  designerIndex: number
  type: DesignerType
  tasks: SetupTask[]
}

export interface SetupPeriod {
  localId: string
  dbId?: string
  label: string
  designerSlots: SetupDesignerSlot[]
}

export interface SetupDay {
  localId: string
  dbId?: string
  number: number
  label: string
  periods: SetupPeriod[]
}

export interface SetupData {
  eventName: string
  designers: SetupDesigner[]
  schedule: SetupDay[]
}

export interface DirectorRow {
  dayNumber: number
  dayLabel: string
  periodId: string
  periodLabel: string
  designerName: string
  taskType: DesignerType
  taskId: string
  taskName: string
  deadline: string | null
  deliveryId: string | null
  status: DeliveryStatus | null
  revisionNote: string | null
}
