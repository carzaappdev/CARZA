import next from '@carza/config/eslint/next';

const config = [...next, { ignores: ['.next/**', 'next-env.d.ts'] }];

export default config;
