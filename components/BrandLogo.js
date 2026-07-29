export default function BrandLogo({
    dark = false,
    size = 120,
    className = ""
}) {

    return (

        <img

            src={
                dark
                    ? "/branding/tayeb-logo-dark.jpeg"
                    : "/branding/tayeb-logo.jpeg"
            }

            alt="Tayeb Logo"

            width={size}

            height={size}

            className={`object-contain ${className}`}

        />

    );

}