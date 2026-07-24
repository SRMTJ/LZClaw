import React from 'react';

import { i18nService } from '../../services/i18n';

const BUSINESS_CENTER_URL = 'http://localhost:3100/users';

const BusinessCenterView: React.FC = () => (
  <div className="relative h-full min-h-0 w-full overflow-hidden bg-white">
    <div className="absolute inset-0 flex items-center justify-center text-sm text-secondary">
      {i18nService.t('businessCenterLoading')}
    </div>
    <iframe
      title={i18nService.t('businessCenter')}
      src={BUSINESS_CENTER_URL}
      className="relative z-10 h-full w-full border-0 bg-white"
      allow="clipboard-read; clipboard-write"
    />
  </div>
);

export default BusinessCenterView;
