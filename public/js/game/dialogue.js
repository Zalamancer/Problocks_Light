export class DialogueBox {
  constructor() {
    this.box = document.getElementById('dialogue-box');
    this.avatarEl = document.getElementById('dialogue-npc-avatar');
    this.npcNameEl = document.getElementById('dialogue-npc-name');
    this.questionEl = document.getElementById('dialogue-question');
    this.choicesEl = document.getElementById('dialogue-choices');
    this.feedbackEl = document.getElementById('dialogue-feedback');
    this.isOpen = false;
  }

  show(npcName, questionData, onAnswer, npcEmoji) {
    this.isOpen = true;
    this.avatarEl.textContent = npcEmoji || '❓';
    this.npcNameEl.textContent = npcName;
    this.questionEl.textContent = questionData.question;
    this.feedbackEl.style.display = 'none';
    this.feedbackEl.className = '';
    this.choicesEl.innerHTML = '';

    const choices = questionData.choices;
    const labels = ['A', 'B', 'C', 'D'];
    choices.forEach((choice, i) => {
      const btn = document.createElement('button');
      btn.className = 'choice-btn';
      const text = typeof choice === 'string' ? choice : choice.text;
      btn.textContent = `${labels[i]}. ${text}`;
      btn.addEventListener('click', () => {
        this.choicesEl.querySelectorAll('button').forEach(b => b.disabled = true);
        onAnswer(i);
      });
      this.choicesEl.appendChild(btn);
    });

    this.box.style.display = 'block';
  }

  showFeedback(result) {
    this.feedbackEl.style.display = 'block';
    if (result.correct) {
      this.feedbackEl.className = 'correct';
      this.feedbackEl.textContent = `✓ Correct! +${result.coinsEarned} coins, +${result.xpEarned} XP`;
    } else {
      this.feedbackEl.className = 'incorrect';
      this.feedbackEl.textContent = `✗ ${result.explanation}`;
    }
    setTimeout(() => this.close(), 3000);
  }

  close() {
    this.box.style.display = 'none';
    this.isOpen = false;
  }
}
