/**
 * LinkedIn integration — URL builders for manual verification.
 * No API available (SNAP partner program closed Aug 2025).
 * We generate search URLs so BDRs can one-click verify contacts in Sales Navigator.
 */

export function buildProfileSearchUrl(params: {
  firstName?: string;
  lastName?: string;
  company?: string;
  title?: string;
}): string {
  const parts: string[] = [];
  if (params.firstName) parts.push(params.firstName);
  if (params.lastName) parts.push(params.lastName);
  if (params.company) parts.push(params.company);
  if (params.title) parts.push(params.title);

  const query = encodeURIComponent(parts.join(' '));
  return `https://www.linkedin.com/search/results/people/?keywords=${query}`;
}

export function buildSalesNavSearchUrl(params: {
  company?: string;
  title?: string;
  seniorityLevel?: string;
}): string {
  // Sales Navigator uses different URL structure
  const parts: string[] = [];
  if (params.company) parts.push(params.company);
  if (params.title) parts.push(params.title);

  const query = encodeURIComponent(parts.join(' '));
  return `https://www.linkedin.com/sales/search/people?query=${query}`;
}

export function buildCompanyPageUrl(companyName: string): string {
  const slug = companyName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+$/, '');
  return `https://www.linkedin.com/company/${slug}`;
}

export interface LinkedInLinks {
  profileSearch: string;
  salesNavSearch: string;
  companyPage: string;
}

export function generateLinkedInLinks(params: {
  contactName?: string;
  contactTitle?: string;
  companyName: string;
}): LinkedInLinks {
  const nameParts = params.contactName?.split(' ') ?? [];

  return {
    profileSearch: buildProfileSearchUrl({
      firstName: nameParts[0],
      lastName: nameParts.slice(1).join(' '),
      company: params.companyName,
      title: params.contactTitle,
    }),
    salesNavSearch: buildSalesNavSearchUrl({
      company: params.companyName,
      title: params.contactTitle,
    }),
    companyPage: buildCompanyPageUrl(params.companyName),
  };
}
