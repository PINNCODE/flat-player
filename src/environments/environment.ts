export const environment = {
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
