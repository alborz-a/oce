// DDC-CWICR-OE: DataDrivenConstruction · OpenConstructionERP
// Copyright (c) 2026 Artem Boiko / DataDrivenConstruction

/** Maps a sidebar route (`NavItem.to`) to the backend module manifest name
 *  (`oe_*`) that powers it. The full `to` is looked up first and the path
 *  without its query string second, so two rows on one path can belong to
 *  different modules (`/bim/rules` is the quantity rules of BIM Hub,
 *  `/bim/rules?mode=requirements` the compliance requirements). When that backend module is
 *  *explicitly* disabled on the System Modules tab, the route below is hidden
 *  so the sidebar never links to a 404/blank surface (the two enable systems
 *  — frontend `useModuleStore` and the backend module loader — were
 *  previously unreconciled, leaving disabled-backend routes live and broken).
 *
 *  Only optional (non-core) modules that own a sidebar route need an entry;
 *  core modules (Dashboard, Projects, BOQ, Costs, Settings, Modules, Users)
 *  can never be disabled and are intentionally absent. Routes not listed here
 *  are never gated by backend state (fail-open).
 *
 *  A list means the route draws on several modules and stays while any of
 *  them is on: the compliance view is the Requirements tab (oe_requirements)
 *  and the Rule Library (oe_bim_requirements), and the page drops the tab of
 *  whichever is off. */
export const ROUTE_BACKEND_MODULE: Record<string, string | readonly string[]> = {
  // Takeoff
  '/quantities': 'oe_takeoff',
  '/takeoff': 'oe_takeoff',
  '/dwg-takeoff': 'oe_dwg_takeoff',
  '/bim': 'oe_bim_hub',
  '/data-explorer': 'oe_cad',
  // Model coordination
  '/coordination': 'oe_coordination_hub',
  '/bim/federations': 'oe_bim_hub',
  '/clash': 'oe_clash',
  '/bim/rules': 'oe_bim_hub',
  '/bim/rules?mode=requirements': ['oe_requirements', 'oe_bim_requirements'],
  '/requirements/matrix': 'oe_requirements',
  '/geo': 'oe_geo_hub',
  // AI & tools
  '/ai-agents': 'oe_ai_agents',
  '/advisor': 'oe_ai',
  '/chat': 'oe_erp_chat',
  '/pipelines': 'oe_pipelines',
  // Commercial
  '/crm': 'oe_crm',
  '/contracts': 'oe_contracts',
  '/payment-clock': 'oe_payment_clock',
  '/tax-withholding': 'oe_tax_withholding',
  '/einvoice-clearance': 'oe_einvoice_clearance',
  '/cost-match': 'oe_cost_match',
  '/full-evm': 'oe_full_evm',
  '/fx': 'oe_fx',
  '/subcontractors': 'oe_subcontractors',
  '/bid-management': 'oe_bid_management',
  '/tendering': 'oe_tendering',
  '/variations': 'oe_variations',
  '/moc': 'oe_moc',
  '/supplier-catalogs': 'oe_supplier_catalogs',
  '/design-options': 'oe_design_options',
  '/formwork': 'oe_formwork',
  // Real estate development
  '/property-dev': 'oe_property_dev',
  '/accommodation': 'oe_accommodation',
  // Planning
  '/schedule': 'oe_schedule',
  '/schedule-advanced': 'oe_schedule_advanced',
  '/portfolio': 'oe_portfolio',
  '/takt': 'oe_schedule_advanced',
  '/tasks': 'oe_tasks',
  '/5d': 'oe_costmodel',
  '/risks': 'oe_risk',
  // Field operations
  '/daily-diary': 'oe_daily_diary',
  '/field-reports': 'oe_fieldreports',
  '/field-time': 'oe_field_time',
  '/equipment': 'oe_equipment',
  '/resources': 'oe_resources',
  '/payroll': 'oe_payroll',
  '/certified-payroll': 'oe_certified_payroll',
  '/service': 'oe_service',
  '/portal': 'oe_portal',
  // Quality
  '/validation': 'oe_validation',
  '/inspections': 'oe_inspections',
  '/construction-control': 'oe_construction_control',
  '/ncr': 'oe_ncr',
  '/punchlist': 'oe_punchlist',
  '/closeout': 'oe_closeout',
  '/qms': 'oe_qms',
  // Safety & HSE
  '/safety': 'oe_safety',
  '/hse-advanced': 'oe_hse_advanced',
  '/carbon': 'oe_carbon',
  // Communication
  '/contacts': 'oe_contacts',
  '/meetings': 'oe_meetings',
  '/rfi': 'oe_rfi',
  '/submittals': 'oe_submittals',
  '/transmittals': 'oe_transmittals',
  '/correspondence': 'oe_correspondence',
  '/inbound-email': 'oe_inbound_email',
  '/collaboration': 'oe_collaboration',
  // Documentation
  '/cde': 'oe_cde',
  '/markups': 'oe_markups',
  // Finance & procurement
  '/finance': 'oe_finance',
  '/procurement': 'oe_procurement',
  '/changeorders': 'oe_changeorders',
  // Analytics & reports
  '/reports': 'oe_reporting',
  '/project-controls': 'oe_project_controls',
  '/bi-dashboards': 'oe_bi_dashboards',
  '/reporting': 'oe_reporting',
  '/architecture': 'oe_architecture_map',
  // v10.6.0 modules
  '/prefab': 'oe_prefab',
  '/cvr': 'oe_cvr',
  '/site-logistics': 'oe_site_logistics',
  '/commissioning': 'oe_commissioning',
  '/esg': 'oe_esg',
  '/forms': 'oe_forms',
  // Delivery-lifecycle registers (v11.11 backend, surfaced in this wave).
  '/site-prep': 'oe_site_prep',
  '/site-inventory': 'oe_site_inventory',
  '/postcalc': 'oe_postcalc',
  '/temporary-works': 'oe_temporary_works',
  '/interface-management': 'oe_interface_management',
  '/defects-liability': 'oe_defects_liability',
  // International delivery / authority modules (frontends added this wave).
  '/authority-submissions': 'oe_authority_submission',
  '/review-authority': 'oe_review_authority',
  '/signing': 'oe_signing',
  '/source-data': 'oe_source_data',
  '/project-route': 'oe_project_route',
  '/site-supervision': 'oe_site_supervision',
};

/**
 * True when the backend module that owns `to` is switched off. Shared by the
 * sidebar and the Ctrl+K palette so both hide the same routes. `isOff` is the
 * caller's view of the System Modules catalogue (fail-open: unknown = not off).
 */
export function routeBackendOff(to: string, isOff: (name: string) => boolean): boolean {
  const path = to.split('?')[0]!;
  const owner = ROUTE_BACKEND_MODULE[to] ?? ROUTE_BACKEND_MODULE[path];
  if (!owner) return false;
  if (typeof owner === 'string') return isOff(owner);
  return owner.every((name) => isOff(name));
}
