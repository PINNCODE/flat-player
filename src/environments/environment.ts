export const environment = {
  production: false,
  preferredStreamFormat: 'm3u8' as const,
  streamProxy: {
    enabled: false,
    basePath: '/iptv',
  },
  autoLogin: {
    enabled: false,
    user: '',
    password: '',
    host: ''
  }
};
