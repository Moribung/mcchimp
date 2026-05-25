import adapter from '@sveltejs/adapter-cloudflare';

export default {
  kit: {
    adapter: adapter({
      platformProxy: {
        enabled: false
      },
      routes: {
        include: ['/*'],
        exclude: ['/embeds/*']
      }
    })
  }
};