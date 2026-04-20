import { Profile } from '../types';

export const defaultProfile: Profile = {
  profileVersion: 'v1',
  targetRoles: [
    'software developer',
    'full stack developer',
    'founding engineer',
  ],
  coreSkills: [
    'javascript',
    'typescript',
    'react',
    'next.js',
    'node.js',
    'postgres',
    'api integration',
  ],
  niceToHave: ['python', 'docker', 'aws'],
  avoid: ['wordpress-only', 'seo-only', 'commission-only', 'unpaid'],
  employmentPreferences: ['remote', 'freelance', 'contract', 'startup'],
  locationPreference: 'India remote or global remote',
  seniorityTarget: 'junior-mid',
  minimumBudgetOrSalary: null,
};
