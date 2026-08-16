import Image from "next/image";

export default function BrandLogo({
    dark = false,
    width = 120,
    height = 44,
    className = "",
}) {
    const logo = dark
        ? "/branding/tayeb-logo-dark.jpeg"
        : "/branding/tayeb-logo.jpeg";

    return (
        <div
            className={`tayeb-logo ${className}`}
            style={{
                width,
                height,
            }}
        >
            <Image
                src={logo}
                alt="Tayeb"
                width={width}
                height={height}
                priority
                style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "contain",
                }}
            />
        </div>
    );
}