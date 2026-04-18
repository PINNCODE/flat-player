export const environment = {
  production: false,
  preferredStreamFormat: 'm3u8' as const,
  streamProxy: {
    enabled: true,
    basePath: '/iptv',
  },
  autoLogin: {
    enabled: false,
    user: '',
    password: '',
    host: ''
  }
};
