export const BusinessCenterIpcChannel = {
  Open: 'businessCenter:open',
  UpdateBounds: 'businessCenter:updateBounds',
  SetVisible: 'businessCenter:setVisible',
  Reload: 'businessCenter:reload',
  Status: 'businessCenter:status',
} as const;

export const BusinessCenterPageUrl = {
  Development: 'http://127.0.0.1:3107',
  Production: 'https://qiye.srmtj.com',
} as const;

export const resolveBusinessCenterPageUrl = (isDevelopment: boolean): string => (
  isDevelopment
    ? BusinessCenterPageUrl.Development
    : BusinessCenterPageUrl.Production
);

export interface BusinessCenterViewBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface BusinessCenterOpenRequest {
  bounds: BusinessCenterViewBounds;
}

export interface BusinessCenterVisibilityRequest {
  visible: boolean;
}

export type BusinessCenterLoadStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface BusinessCenterStatusUpdate {
  status: BusinessCenterLoadStatus;
  error?: string;
}
