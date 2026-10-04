import { groupByDay } from '../NotificationInboxScreen';

// Spec 077 PO-8 (AC-5.1): o bucket sai do dia de SP do sent_at — o corte do ISO dava o dia UTC e
// a notificação das 21h–00h caía no dia seguinte (diff -1 → nenhum bucket certo).
describe('groupByDay', () => {
  beforeEach(() => {
    jest.useFakeTimers({ now: new Date('2026-09-02T01:45:00Z') }); // 22:45 de 01/09 em SP
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it('notificação das 22:30 de SP cai em "Hoje"', () => {
    const groups = groupByDay([{ id: 'n1', sent_at: '2026-09-02T01:30:00Z' }]);
    expect(groups.map(g => g.title)).toEqual(['Hoje']);
  });

  it('notificação das 23:00 de SP do dia anterior cai em "Ontem"', () => {
    const groups = groupByDay([{ id: 'n2', sent_at: '2026-09-01T02:00:00Z' }]);
    expect(groups.map(g => g.title)).toEqual(['Ontem']);
  });

  it('sem sent_at é ignorada', () => {
    expect(groupByDay([{ id: 'n3', sent_at: null }])).toEqual([]);
  });
});
