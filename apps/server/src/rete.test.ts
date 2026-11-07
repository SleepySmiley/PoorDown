import type { NetworkInterfaceInfo } from 'node:os';
import { describe, expect, it } from 'vitest';
import { scegliIndirizzi } from './rete';

function v4(address: string, internal = false): NetworkInterfaceInfo {
  return { address, netmask: '255.255.255.0', family: 'IPv4', mac: '00:00:00:00:00:00', internal, cidr: `${address}/24` };
}

function v6(address: string): NetworkInterfaceInfo {
  return { address, netmask: 'ffff:ffff:ffff:ffff::', family: 'IPv6', mac: '00:00:00:00:00:00', internal: false, cidr: `${address}/64`, scopeid: 0 };
}

describe('scegliIndirizzi', () => {
  it('scarta loopback, IPv6 e indirizzi automatici 169.254', () => {
    const risultato = scegliIndirizzi({
      'Loopback Pseudo-Interface 1': [v4('127.0.0.1', true)],
      'Wi-Fi': [v6('fe80::1'), v4('192.168.1.23')],
      Ethernet: [v4('169.254.10.4')],
    });
    expect(risultato).toEqual([{ scheda: 'Wi-Fi', ip: '192.168.1.23' }]);
  });

  it('nasconde le schede virtuali quando ce ne sono di reali', () => {
    const risultato = scegliIndirizzi({
      'vEthernet (WSL)': [v4('172.20.48.1')],
      'VirtualBox Host-Only Network': [v4('192.168.56.1')],
      'Wi-Fi': [v4('192.168.1.23')],
    });
    expect(risultato.map((i) => i.ip)).toEqual(['192.168.1.23']);
  });

  it('mette prima la rete di casa e dopo le VPN', () => {
    const risultato = scegliIndirizzi({
      Tailscale: [v4('100.101.102.103')],
      'Ethernet 2': [v4('10.0.0.5')],
      'Wi-Fi': [v4('192.168.1.23')],
    });
    expect(risultato.map((i) => i.scheda)).toEqual(['Ethernet 2', 'Wi-Fi', 'Tailscale']);
  });

  it('usa le schede virtuali se non c’è altro', () => {
    const risultato = scegliIndirizzi({ 'vEthernet (Default Switch)': [v4('172.17.0.1')] });
    expect(risultato).toEqual([{ scheda: 'vEthernet (Default Switch)', ip: '172.17.0.1' }]);
  });

  it('restituisce una lista vuota senza rete', () => {
    expect(scegliIndirizzi({ 'Loopback Pseudo-Interface 1': [v4('127.0.0.1', true)] })).toEqual([]);
  });
});
