"use client";

import { useMemo, useState } from "react";
import { ArrowUpRight, Check, Heart, QrCode, WalletCards } from "lucide-react";

const presets = [25_000, 50_000, 100_000];
const rupiah = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 });
const paymentMethods = [
  { id: "virtual-account", label: "Virtual Account BCA", icon: WalletCards },
  { id: "gopay", label: "GoPay", icon: WalletCards },
  { id: "qris", label: "QRIS", icon: QrCode },
] as const;

export function DonateContribution() {
  const [selectedPreset, setSelectedPreset] = useState<number | null>(presets[0]);
  const [customAmount, setCustomAmount] = useState("");
  const [selectedMethod, setSelectedMethod] = useState<(typeof paymentMethods)[number]["id"]>("virtual-account");

  const parsedCustomAmount = Number(customAmount);
  const amount = selectedPreset ?? (Number.isFinite(parsedCustomAmount) ? parsedCustomAmount : 0);
  const formattedAmount = useMemo(() => `Rp ${rupiah.format(amount || 0)}`, [amount]);
  return (
    <section className="contribution-section" aria-labelledby="contribution-title">
      <div className="contribution-heading">
        <div className="contribution-heading-icon"><Heart size={18} /></div>
        <div>
          <p className="eyebrow">SUPPORT THE PLATFORM</p>
          <h2 id="contribution-title">Choose your contribution</h2>
          <p>Every contribution helps keep WERKS useful and independent.</p>
        </div>
      </div>

      <div className="contribution-layout">
        <div className="contribution-form">
          <div className="contribution-amount-row">
            <fieldset className="contribution-presets">
              <legend className="contribution-label">Choose an amount</legend>
              <div className="contribution-options">
                {presets.map((preset) => (
                  <button
                    className={`contribution-option${selectedPreset === preset ? " is-selected" : ""}`}
                    type="button"
                    key={preset}
                    aria-pressed={selectedPreset === preset}
                    onClick={() => { setSelectedPreset(preset); setCustomAmount(""); }}
                  >
                    Rp{rupiah.format(preset / 1000)}K
                  </button>
                ))}
              </div>
            </fieldset>

            <label className="contribution-field">
              <span className="contribution-label">Other amount <span>(IDR)</span></span>
              <span className="contribution-input-wrap"><span>Rp</span><input type="number" min="1000" step="1000" inputMode="numeric" placeholder="Enter your contribution" value={customAmount} onChange={(event) => { setSelectedPreset(null); setCustomAmount(event.target.value); }} /></span>
            </label>
          </div>

          <div className="contribution-method">
            <span className="contribution-label">Payment method</span>
            <div className="contribution-method-list">
              {paymentMethods.map(({ id, label, icon: Icon }) => (
                <label className={`contribution-method-card${selectedMethod === id ? " is-selected" : ""}`} key={id}>
                  <input type="radio" name="donation-payment-method" value={id} checked={selectedMethod === id} onChange={() => setSelectedMethod(id)} />
                  <span className="contribution-method-icon"><Icon size={17} /></span>
                  <span><strong>{label}</strong></span>
                  <span className="contribution-method-check" aria-hidden="true">{selectedMethod === id && <Check size={14} />}</span>
                </label>
              ))}
            </div>
          </div>

          <aside className="contribution-summary" aria-live="polite">
            <div className="contribution-summary-value">
              <span className="contribution-summary-label">Your contribution</span>
              <strong>{formattedAmount}</strong>
            </div>
            <button className="contribution-submit" type="button" disabled>
              Continue to Payment <ArrowUpRight size={16} />
            </button>
          </aside>
        </div>
      </div>
    </section>
  );
}
