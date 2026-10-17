import { findCountry, sortedCountries } from "../../lib/countries";
import { useLanguage } from "../../lib/LanguageContext";

/*
 * Country (flag + calling code) and phone number together.
 * People can also paste a full "+234…" number: the server
 * reads the country from it.
 */
export default function PhoneInput({ country, onCountry, value, onChange, disabled, autoFocus, id, required = true, placeholder: hint }) {
    const { language } = useLanguage();

    const selected = findCountry(country);

    const placeholder = hint || (selected ? "0".repeat(selected.nsn[1]).replace(/0{3}(?=0)/g, "000 ").trim() : "");

    return (
        <div className="ts-phone">
            <select
                value={country}
                onChange={(event) => onCountry(event.target.value)}
                disabled={disabled}
                aria-label={language === "fr" ? "Pays" : "Country"}
            >
                {sortedCountries(language).map((item) => (
                    <option key={item.code} value={item.code}>
                        {item.flag} +{item.dial}
                    </option>
                ))}
            </select>
            <input
                id={id}
                type="tel"
                inputMode="tel"
                autoComplete="tel-national"
                value={value}
                onChange={(event) => onChange(event.target.value)}
                placeholder={placeholder}
                disabled={disabled}
                autoFocus={autoFocus}
                required={required}
            />
        </div>
    );
}
