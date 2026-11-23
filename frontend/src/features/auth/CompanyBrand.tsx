import { useEffect } from 'react';
import { useBrandingStore } from '@/stores/useBrandingStore';
import { COMPANY_INFO } from '@/app/companyInfo.fa';

/** Company logo and name for the public auth pages; same source as the sign-in page, never the OCE mark. */
export function CompanyBrand() {
  const { mode, logoDataUrl, companyName } = useBrandingStore();
  useEffect(() => {
    void useBrandingStore.getState().hydrateFromServer();
  }, []);
  const customised = mode === 'logo' || mode === 'text';
  return (
    <div className="mx-auto flex items-center justify-center gap-2.5" data-testid="company-brand">
      {customised && mode === 'logo' && logoDataUrl ? (
        <img src={logoDataUrl} alt={companyName || COMPANY_INFO.name} className="block max-h-16 w-auto max-w-full object-contain" draggable={false} />
      ) : (
        <>
          <img src={COMPANY_INFO.logoPath} alt={COMPANY_INFO.name} className="h-10 w-10 object-contain" />
          <span className="text-2xl font-bold text-content-primary whitespace-nowrap">
            {customised && companyName ? companyName : COMPANY_INFO.name}
          </span>
        </>
      )}
    </div>
  );
}
