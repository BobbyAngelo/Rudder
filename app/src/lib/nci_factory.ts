/**
 * NCI (Neuro-Cognitive Influence) Prompt Factory (Phase 10B)
 *
 * Implements the 17 sentence structures of NCI Level 4 (Grad School)
 * directly into RUDDER's LLM prompting architecture.
 *
 * Non-negotiable: Standard hyphens, colons, or parentheses only. Zero em-dashes.
 */

export interface NCIBiometricState {
  hrvCurrent: number;
  hrvBaseline: number;
  sleepHours: number;
  activeProject?: string;
  recentReflections?: string;
}

export interface NCIPrompt {
  systemPrompt: string;
  userPrompt: string;
  temperature: number;
}

export class NCIFactory {
  /**
   * Sentence 1: The Reversal
   * We establish a position the listener already holds, then ask why they don't hold a weaker version of it.
   */
  static buildReversal(state: NCIBiometricState): NCIPrompt {
    const hrvDelta = state.hrvCurrent - state.hrvBaseline;
    const isHighStrain = hrvDelta < -10 || state.sleepHours < 6.0;

    let systemPrompt = `You are a high-influence cognitive partner utilizing the NCI Reversal architecture.
Your objective is to establish a position the user already holds (that their health and recovery matter) and ask why they do not hold a weaker version of it.
Never direct, instruct, or nag the user to rest. Let their own neurology build the case for recovery.`;

    let userPrompt = "";
    if (isHighStrain) {
      userPrompt = `Biometric Telemetry:
- HRV: ${state.hrvCurrent}ms (Baseline: ${state.hrvBaseline}ms, Delta: ${hrvDelta}ms)
- Sleep: ${state.sleepHours} hours

Generate one NCI Reversal question centered on: 'What is stopping this biometric strain from being something you just ignore today?'`;
    } else {
      userPrompt = `Biometric Telemetry:
- HRV: ${state.hrvCurrent}ms (Baseline: ${state.hrvBaseline}ms)
- Sleep: ${state.sleepHours} hours

Generate one NCI Reversal question centered on: 'What is stopping you from just ignoring your focus guidelines and coasting today?'`;
    }

    return { systemPrompt, userPrompt, temperature: 0.6 };
  }

  /**
   * Sentence 2: The Impossible Question
   * Describe the conditions under which a decision would not require thought (making it 'obvious').
   */
  static buildImpossibleQuestion(project: string): NCIPrompt {
    const systemPrompt = `You are a high-influence coach utilizing the NCI Impossible Question architecture.
Your objective is to bypass traditional logistics or advice.
Instead of telling the user what to do, ask them to describe the conditions under which executing the task would feel completely obvious.`;

    const userPrompt = `Project Node: ${project}

Generate one NCI Impossible Question matching the format: 'What would need to be true for completing ${project} to feel like the obvious next move right now?'`;

    return { systemPrompt, userPrompt, temperature: 0.5 };
  }

  /**
   * Sentence 3: The Presupposition
   * Embed the desired conclusion in the grammar of the question (e.g. 'What was the moment you realized that...').
   */
  static buildPresupposition(state: NCIBiometricState): NCIPrompt {
    const systemPrompt = `You are a cognitive alignment specialist utilizing NCI Presupposition.
Your objective is to embed the conclusion that the user is fully capable and ready inside the grammatical structure of a question.
Do not ask whether clarity exists. Assume it is an absolute fact and ask when it occurred.`;

    const userPrompt = `Current Context:
- Active Project: ${state.activeProject || "Sovereign Cluster Refactoring"}
- Reflections: "${state.recentReflections?.substring(0, 200) || "No recent reflections"}"

Generate one NCI Presupposition question matching the format: 'What was the moment you realized that...' or 'What finally made it click that...'`;

    return { systemPrompt, userPrompt, temperature: 0.7 };
  }

  /**
   * Sentence 4: The Label & Sentence 8: The Reframe
   * Peel off negative emotional labels (stress, anxiety) and re-label them to raw neuro-cognitive readiness.
   */
  static buildLabelAndReframe(text: string): NCIPrompt {
    const systemPrompt = `You are a cognitive reframing specialist utilizing NCI Labeling and Reframing.
Take the generic negative label the user has put on their internal state (like 'stressed', 'anxious', or 'scared') and peel it off.
Relabel it to its underlying neuro-cognitive reality (like 'ready', 'focused', or 'caring').
Do not tell them to calm down. Change the story around the physical feeling so their prefrontal cortex runs a different protocol.`;

    const userPrompt = `User Log: "${text}"

Provide a professional NCI reframe matching the pattern: 'That isn't anxiety. That is just your body telling you that this actually matters. What do you notice when you begin to see it as readiness?'`;

    return { systemPrompt, userPrompt, temperature: 0.5 };
  }

  /**
   * Sentence 6: The Witness
   * Name who the user has been, showing them that their struggle and silent composure is fully visible.
   */
  static buildWitness(state: NCIBiometricState): NCIPrompt {
    const systemPrompt = `You are a deep cognitive mirror utilizing the NCI Witness architecture.
Your role is to bypass the user's default mode network by describing a genuine composed quality you observe in their biometrics or logs.
Describe a type of person they are in a way that makes them feel deeply seen and secure.`;

    const userPrompt = `Context Summary:
- HRV: ${state.hrvCurrent}ms
- Sleep: ${state.sleepHours} hours
- Recent reflections: "${state.recentReflections?.substring(0, 200) || "handling complex systems"}"

Generate one NCI Witness reflection describing a type of person who handles hard things quietly, matching the pattern: 'I think there is a kind of person who never lets anyone see them struggling...'`;

    return { systemPrompt, userPrompt, temperature: 0.6 };
  }

  /**
   * Sentence 17: The Exit Seal
   * Imply that the answer already exists inside them and they have known it for a while.
   */
  static buildExitSeal(state: NCIBiometricState): NCIPrompt {
    const systemPrompt = `You are an influential sovereign guide utilizing the NCI Exit Seal architecture.
Do not offer advice, suggestions, or pitch outcomes.
Bypass their logical calculations by reminding them that they already hold the answer and are simply waiting to execute.`;

    const userPrompt = `Project Node: ${state.activeProject || "Sovereign cluster advancement"}

Generate one soft, high-tension NCI Exit Seal statement matching the pattern: 'But I do want to say... you already know what you need to do here, and you have known for a little while.'`;

    return { systemPrompt, userPrompt, temperature: 0.6 };
  }
}
