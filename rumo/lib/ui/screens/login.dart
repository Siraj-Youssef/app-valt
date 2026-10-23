import 'package:flutter/material.dart';

import '../../data/session.dart';
import '../../theme.dart';
import '../widgets.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key, required this.onDone, this.notice});
  final Future<void> Function(Session session, bool isNew) onDone;
  final String? notice;
  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  bool _register = true;
  bool _busy = false;
  bool _showServer = false;
  late String? _error = widget.notice;
  final _name = TextEditingController();
  final _email = TextEditingController();
  final _password = TextEditingController();
  final _server = TextEditingController(text: defaultServerUrl());

  @override
  void initState() {
    super.initState();
    for (final c in [_email, _password, _server]) {
      c.addListener(() => setState(() {}));
    }
  }

  @override
  void dispose() {
    for (final c in [_name, _email, _password, _server]) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> _submit() async {
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final s = await authenticate(register: _register, serverUrl: _server.text, email: _email.text.trim(), password: _password.text, name: _name.text.trim());
      await widget.onDone(s, _register);
    } on AuthException catch (e) {
      if (mounted) setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final canSubmit = _email.text.trim().isNotEmpty && _password.text.length >= 6 && !_busy;
    return Scaffold(
      body: SafeArea(
        child: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 460),
            child: ListView(padding: const EdgeInsets.fromLTRB(24, 40, 24, 24), shrinkWrap: true, children: [
              Align(
                alignment: Alignment.centerLeft,
                child: Container(
                  width: 64,
                  height: 64,
                  decoration: BoxDecoration(color: C.primary, borderRadius: BorderRadius.circular(18)),
                  child: const Icon(Icons.explore, size: 36, color: C.onPrimary),
                ),
              ),
              const SizedBox(height: 22),
              Text.rich(TextSpan(children: [
                TextSpan(text: 'rumo', style: display(52, weight: FontWeight.w700, spacing: -1.5)),
                TextSpan(text: '.', style: display(52, weight: FontWeight.w700, color: C.primary)),
              ])),
              const SizedBox(height: 4),
              Text('Um passo de cada vez.', style: display(20, color: C.inkDim)),
              const SizedBox(height: 10),
              Text('Planeje hábitos, some pontos e veja sua rota do mês, no celular e no computador.', style: body(15, color: C.inkDim)),
              const SizedBox(height: 26),
              UnderlineTabs<bool>(
                value: _register,
                onChanged: (v) => setState(() => _register = v),
                options: const [(true, 'Criar conta', null), (false, 'Já tenho conta', null)],
              ),
              if (_register) ...[
                const Label('Nome'),
                TextField(controller: _name, style: body(16), decoration: const InputDecoration(hintText: 'Como quer ser chamado')),
              ],
              const Label('E-mail'),
              TextField(
                controller: _email,
                style: body(16),
                keyboardType: TextInputType.emailAddress,
                autofillHints: const [AutofillHints.email],
                decoration: const InputDecoration(hintText: 'voce@email.com'),
              ),
              const Label('Senha'),
              TextField(
                controller: _password,
                style: body(16),
                obscureText: true,
                autofillHints: [_register ? AutofillHints.newPassword : AutofillHints.password],
                decoration: const InputDecoration(hintText: 'mínimo 6 caracteres'),
                onSubmitted: (_) => canSubmit ? _submit() : null,
              ),
              const SizedBox(height: 14),
              InkWell(
                onTap: () => setState(() => _showServer = !_showServer),
                child: Padding(
                  padding: const EdgeInsets.symmetric(vertical: 6),
                  child: Row(children: [
                    const Icon(Icons.dns_outlined, size: 14, color: C.inkFaint),
                    const SizedBox(width: 6),
                    Expanded(child: Text('Servidor: ${_server.text}', style: body(13, color: C.inkFaint), overflow: TextOverflow.ellipsis)),
                  ]),
                ),
              ),
              if (_showServer)
                Padding(
                  padding: const EdgeInsets.only(top: 6),
                  child: TextField(
                    controller: _server,
                    style: body(15),
                    autocorrect: false,
                    keyboardType: TextInputType.url,
                    decoration: const InputDecoration(hintText: 'http://192.168.0.10:8787'),
                  ),
                ),
              if (_error != null) Padding(padding: const EdgeInsets.only(top: 14), child: Text(_error!, style: body(13, color: C.danger))),
              const SizedBox(height: 24),
              _busy
                  ? const Center(child: CircularProgressIndicator(color: C.primary))
                  : PrimaryButton(label: _register ? 'Começar' : 'Entrar', icon: Icons.arrow_forward, onPressed: canSubmit ? _submit : null),
            ]),
          ),
        ),
      ),
    );
  }
}
