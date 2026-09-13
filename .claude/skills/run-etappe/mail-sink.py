"""A throwaway SMTP server that writes what it receives to files.

For exercising the registration gate (pb_hooks/registration.pb.js), which
sends a verification link to the registrant and an approve/reject link to
the owner. Without a mail server registration fails closed, by design, so
there is no way to test the gate without one.

    python3 mail-sink.py            # listens on 127.0.0.1:2526
    ETAPPE_MAIL_PORT=2530 python3 mail-sink.py

Then start PocketBase pointed at it — see SKILL.md, "Testing the
registration gate".
"""
import asyncore, smtpd, os, time, email

OUT = os.environ.get("ETAPPE_MAIL_DIR", "/tmp/etappe-mail")
PORT = int(os.environ.get("ETAPPE_MAIL_PORT", "2526"))

class Sink(smtpd.SMTPServer):
    def process_message(self, peer, mailfrom, rcpttos, data, **kw):
        if isinstance(data, bytes):
            data = data.decode("utf-8", "replace")
        msg = email.message_from_string(data)
        if msg.is_multipart():
            body = "\n".join(
                p.get_payload(decode=True).decode("utf-8", "replace")
                for p in msg.walk()
                if p.get_payload(decode=True)
            )
        else:
            body = msg.get_payload(decode=True).decode("utf-8", "replace")
        name = f"{OUT}/{int(time.time()*1000)}-{','.join(rcpttos)}.txt"
        with open(name, "w") as f:
            f.write(f"To: {','.join(rcpttos)}\nSubject: {msg.get('Subject','')}\n\n{body}\n")
        print("received:", name, flush=True)
        return

if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    Sink(("127.0.0.1", PORT), None)
    print("sink listening on 127.0.0.1:2526", flush=True)
    asyncore.loop()
