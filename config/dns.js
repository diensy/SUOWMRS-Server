import dns from 'dns';

// Configure DNS resolvers prior to loading MongoDB driver / Mongoose
try {
  dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);
} catch (e) {
  console.warn('[DNS Warning] Could not set custom DNS servers:', e.message);
}

try {
  dns.setDefaultResultOrder('ipv4first');
} catch (e) {}
