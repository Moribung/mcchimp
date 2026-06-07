import adapter from '@sveltejs/adapter-cloudflare';

export default {
  kit: {
    adapter: adapter({
      platformProxy: {
        enabled: true
      },
      routes: {
        include: ['/*'],
        exclude: ['/embeds/*']
      }
    })
  }
};