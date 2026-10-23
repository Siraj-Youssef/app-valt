// Regras de pontuação, marcos, sequência, etapa e rota — tudo derivado dos registros locais.
import 'dart:math';

import '../data/store.dart';
import 'dates.dart';

class Task {
  Task({
    required this.id,
    required this.title,
    required this.icon,
    required this.points,
    required this.repeat,
    required this.weekdays,
    required this.startDate,
    this.date,
    this.time,
    this.durationMin,
  });
  final String id, title, icon, repeat, startDate; // repeat: 'weekly' | 'once'
  final int points;
  final List<int> weekdays; // 0 = segunda ... 6 = domingo
  final String? date, time;
  final int? durationMin;

  factory Task.fromJson(String id, Map<String, dynamic> j) => Task(
        id: id,
        title: j['title'] as String? ?? '',
        icon: j['icon'] as String? ?? '•',
        points: (j['points'] as num?)?.toInt() ?? 0,
        repeat: j['repeat'] as String? ?? 'weekly',
        weekdays: ((j['weekdays'] as List?) ?? const []).map((e) => (e as num).toInt()).toList(),
        startDate: j['startDate'] as String? ?? '0000-00-00',
        date: j['date'] as String?,
        time: j['time'] as String?,
        durationMin: (j['durationMin'] as num?)?.toInt(),
      );

  Map<String, dynamic> toJson() => {
        'title': title,
        'icon': icon,
        'points': points,
        'repeat': repeat,
        'weekdays': weekdays,
        'startDate': startDate,
        if (date != null) 'date': date,
        if (time != null) 'time': time,
        if (durationMin != null) 'durationMin': durationMin,
      };
}

class Goal {
  Goal({required this.id, required this.title, required this.icon, required this.period, required this.target, required this.unit});
  final String id, title, icon, period, unit; // period: 'week' | 'month' | 'year'
  final int target;
  factory Goal.fromJson(String id, Map<String, dynamic> j) => Goal(
        id: id,
        title: j['title'] as String? ?? '',
        icon: j['icon'] as String? ?? '🏆',
        period: j['period'] as String? ?? 'month',
        target: (j['target'] as num?)?.toInt() ?? 1,
        unit: j['unit'] as String? ?? 'vezes',
      );
  Map<String, dynamic> toJson() => {'title': title, 'icon': icon, 'period': period, 'target': target, 'unit': unit};
}

String completionId(String taskId, String date) => '$taskId@$date';

class Model {
  Model._(this.tasks, this.doneByDate, this.pointsByDate, this.completionPoints, this.daily, this.profileName, this.startDate, this.goals, this.goalLogs);

  final List<Task> tasks;
  final Map<String, List<String>> doneByDate;
  final Map<String, int> pointsByDate;
  final Map<String, int> completionPoints; // id da conclusão -> pontos (só concluídas)
  final List<int> daily;
  final String? profileName;
  final String startDate;
  final List<Goal> goals;
  final List<({String goalId, String date, int amount})> goalLogs;

  static Model? _cache;
  static int _cacheVersion = -1;

  factory Model.of(Store s) {
    if (_cache != null && _cacheVersion == s.version) return _cache!;
    final tasks = s.live('tasks').map((e) => Task.fromJson(e.key, e.value)).toList()
      ..sort((a, b) {
        final t = (a.time ?? '99').compareTo(b.time ?? '99');
        return t != 0 ? t : a.title.compareTo(b.title);
      });
    final doneByDate = <String, List<String>>{};
    final pointsByDate = <String, int>{};
    final completionPoints = <String, int>{};
    for (final e in s.live('completions')) {
      final c = e.value;
      if (c['done'] != true) continue;
      final date = c['date'] as String;
      final pts = (c['points'] as num?)?.toInt() ?? 0;
      pointsByDate[date] = (pointsByDate[date] ?? 0) + pts;
      (doneByDate[date] ??= []).add(c['taskId'] as String);
      completionPoints[e.key] = pts;
    }
    final goalsRec = s.get('settings', 'goals');
    final profile = s.get('settings', 'profile');
    final daily = ((goalsRec?['daily'] as List?) ?? const [0, 0, 0, 0, 0, 0, 0]).map((e) => (e as num).toInt()).toList();
    while (daily.length < 7) {
      daily.add(0);
    }
    final m = Model._(
      tasks,
      doneByDate,
      pointsByDate,
      completionPoints,
      daily,
      profile?['name'] as String?,
      profile?['startDate'] as String? ?? todayKey(),
      s.live('goals').where((e) => e.value['archived'] != true).map((e) => Goal.fromJson(e.key, e.value)).toList(),
      s
          .live('goalLogs')
          .map((e) => (goalId: e.value['goalId'] as String, date: e.value['date'] as String, amount: (e.value['amount'] as num).toInt()))
          .toList(),
    );
    _cache = m;
    _cacheVersion = s.version;
    return m;
  }

  List<Task> tasksFor(String date) {
    final wd = weekdayOf(date);
    return tasks.where((t) => t.repeat == 'once' ? t.date == date : date.compareTo(t.startDate) >= 0 && t.weekdays.contains(wd)).toList();
  }

  bool isDone(String taskId, String date) => completionPoints.containsKey(completionId(taskId, date));
  int pointsOn(String date) => pointsByDate[date] ?? 0;
  int goalOn(String date) => daily[weekdayOf(date)];
  bool metOn(String date) => goalOn(date) > 0 && pointsOn(date) >= goalOn(date);
  int get weekGoal => daily.fold(0, (a, b) => a + b);

  // Sequência: dias seguidos batendo a meta. Dias com meta 0 são livres: não quebram nem contam.
  // Hoje ainda não batido não zera a sequência — o dia não acabou.
  ({int current, int best}) streaks([String? today]) {
    today ??= todayKey();
    var best = 0, run = 0;
    for (final k in rangeKeys(startDate, today)) {
      if (goalOn(k) == 0) continue;
      if (metOn(k)) {
        run++;
        best = max(best, run);
      } else if (k != today) {
        run = 0;
      }
    }
    return (current: run, best: best);
  }

  // Etapa: começa em 1 e avança a cada semana em que a meta semanal foi batida.
  ({int level, int weekPoints, int weekGoal, int missing}) level([String? today]) {
    today ??= todayKey();
    final goal = weekGoal;
    var met = 0;
    for (var monday = weekKeys(startDate).first; monday.compareTo(today) <= 0; monday = addDays(monday, 7)) {
      final pts = weekKeys(monday).fold(0, (a, k) => a + pointsOn(k));
      if (goal > 0 && pts >= goal) met++;
    }
    final thisWeek = weekKeys(today).fold(0, (a, k) => a + pointsOn(k));
    return (level: 1 + met, weekPoints: thisWeek, weekGoal: goal, missing: max(0, goal - thisWeek));
  }

  ({List<String> keys, int points, int goal, int marks, int stepsDone, double pace, int projection, bool hasGoal}) month(int year, int month,
      [String? today]) {
    today ??= todayKey();
    final keys = monthKeys(year, month);
    final points = keys.fold(0, (a, k) => a + pointsOn(k));
    final goal = keys.fold(0, (a, k) => a + goalOn(k));
    final marks = keys.where(metOn).length;
    final steps = keys.fold(0, (a, k) => a + (doneByDate[k]?.length ?? 0));
    // Ritmo = pontos feitos / meta acumulada dos dias já vividos (a partir do início de uso).
    final elapsed = keys.where((k) => k.compareTo(today!) <= 0 && k.compareTo(startDate) >= 0);
    final goalSoFar = elapsed.fold(0, (a, k) => a + goalOn(k));
    final pace = goalSoFar > 0 ? points / goalSoFar : 0.0;
    return (keys: keys, points: points, goal: goal, marks: marks, stepsDone: steps, pace: pace, projection: (goal * pace).round(), hasGoal: goalSoFar > 0);
  }

  ({int done, double ratio}) goalProgress(Goal g, [String? today]) {
    today ??= todayKey();
    final now = DateTime.now();
    final from = switch (g.period) {
      'week' => weekKeys(today).first,
      'month' => toKey(DateTime(now.year, now.month, 1)),
      _ => '${now.year}-01-01',
    };
    final done = goalLogs
        .where((l) => l.goalId == g.id && l.date.compareTo(from) >= 0 && l.date.compareTo(today!) <= 0)
        .fold(0, (a, l) => a + l.amount);
    return (done: done, ratio: g.target > 0 ? min(1.0, done / g.target) : 0.0);
  }

  // "Bússola": uma frase de orientação para o momento, sempre com o próximo passo concreto.
  ({String text, String? action}) compassTip([String? today]) {
    today ??= todayKey();
    final pts = pointsOn(today), goal = goalOn(today);
    if (tasks.isEmpty) return (text: 'Seu mapa está em branco. Adicione o primeiro hábito e diga quanto ele vale.', action: 'new');
    if (weekGoal == 0) return (text: 'Defina quantos pontos quer fazer por dia para traçar sua rota.', action: 'goals');
    if (goal > 0 && pts >= goal) return (text: 'Marco do dia alcançado com $pts pts. Descanse ou siga adiante.', action: null);
    final left = tasksFor(today).where((t) => !isDone(t.id, today!)).toList();
    if (goal > 0 && left.isNotEmpty) {
      left.sort((a, b) => (a.durationMin ?? 99).compareTo(b.durationMin ?? 99));
      final next = left.first;
      return (text: 'Faltam ${goal - pts} pts para o marco de hoje. Próximo passo: ${next.icon} ${next.title}.', action: null);
    }
    if (goal == 0) return (text: 'Hoje é dia livre na sua rota. Qualquer passo conta como extra.', action: null);
    return (text: 'Faltam ${goal - pts} pts e o plano de hoje acabou. Que tal um passo extra?', action: 'new');
  }
}

String periodOf(String? time) {
  if (time == null) return 'Qualquer hora';
  final h = int.tryParse(time.substring(0, 2)) ?? 0;
  return h < 12 ? 'Manhã' : h < 18 ? 'Tarde' : 'Noite';
}

({String label, String tone, String body}) routeStatus(double pace, bool hasGoal) {
  if (!hasGoal) return (label: 'Sem rota', tone: 'muted', body: 'Defina pontos por dia para ver a previsão do mês.');
  if (pace >= 1) return (label: 'Em rota', tone: 'good', body: 'Mantendo esse passo, você chega à meta do mês.');
  if (pace >= 0.8) return (label: 'Perto da rota', tone: 'warn', body: 'Um pouco mais por dia e você volta à rota.');
  return (label: 'Fora da rota', tone: 'bad', body: 'Ajuste o passo: escolha hábitos menores ou revise a meta.');
}
